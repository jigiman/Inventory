using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Backend.Data;
using Backend.Services;

namespace Backend.Features;

public static class LauncherEndpoints
{
    public static void MapLauncherEndpoints(this WebApplication app)
    {
        // ── GET /api/launcher ─────────────────────────────────────────────────
        // Returns current status + list of recently used databases + current theme.
        app.MapGet("/api/launcher", (DatabaseState state) =>
        {
            var config = LauncherConfig.Load();
            return Results.Ok(new
            {
                status = state.IsInitialized ? "READY" : "NOT_INITIALIZED",
                recentDatabases = config.RecentDatabases,
                theme = config.Theme,
                sessionToken = state.SessionToken
            });
        });

        // ── GET /api/launcher/check-update ────────────────────────────────────
        // Queries GitHub API for the latest release, comparing with current version.
        app.MapGet("/api/launcher/check-update", async () =>
        {
            try
            {
                using var client = new System.Net.Http.HttpClient();
                client.DefaultRequestHeaders.UserAgent.ParseAdd("InventorySystem-Updater");
                
                var url = $"https://api.github.com/repos/{AppVersionInfo.GitHubRepo}/releases/latest";
                var response = await client.GetStringAsync(url);
                
                using var doc = System.Text.Json.JsonDocument.Parse(response);
                var root = doc.RootElement;
                
                var tag = root.GetProperty("tag_name").GetString()?.Replace("v", "") ?? "0.0.0";
                var htmlUrl = root.GetProperty("html_url").GetString() ?? "";

                if (Version.TryParse(tag, out var latestVersion) && Version.TryParse(AppVersionInfo.CurrentVersion, out var currentVersion))
                {
                    if (latestVersion > currentVersion)
                    {
                        return Results.Ok(new
                        {
                            updateAvailable = true,
                            latestVersion = tag,
                            currentVersion = AppVersionInfo.CurrentVersion,
                            downloadUrl = htmlUrl
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "Failed to check for updates from GitHub.");
            }

            return Results.Ok(new
            {
                updateAvailable = false,
                latestVersion = AppVersionInfo.CurrentVersion,
                currentVersion = AppVersionInfo.CurrentVersion,
                downloadUrl = ""
            });
        });

        // ── POST /api/launcher/theme ───────────────────────────────────────────
        // Saves the user's light/dark theme choice.
        app.MapPost("/api/launcher/theme", (ThemeRequest req) =>
        {
            if (req.Theme != "light" && req.Theme != "dark")
                return Results.BadRequest("Theme must be 'light' or 'dark'.");

            var config = LauncherConfig.Load();
            config.Theme = req.Theme;
            config.Save();

            Log.Information("Theme updated to {Theme}", req.Theme);
            return Results.Ok(new { theme = config.Theme });
        });

        // ── POST /api/launcher/open ───────────────────────────────────────────
        // Opens an existing database file. Runs pending migrations.
        app.MapPost("/api/launcher/open", async (
            OpenDatabaseRequest req,
            DatabaseState dbState,
            IServiceProvider services) =>
        {
            if (string.IsNullOrWhiteSpace(req.DbPath))
                return Results.BadRequest("dbPath is required.");

            if (!ValidatePath(req.DbPath, out var path, out var error))
                return Results.BadRequest(error);

            if (!File.Exists(path))
                return Results.BadRequest($"Database file not found: {path}");

            // Try to load saved credential if password is not provided
            var password = req.Password;
            if (string.IsNullOrEmpty(password))
            {
                password = CredentialManager.GetCredential(path);
            }

            dbState.DbPath = path;
            dbState.Password = password;

            try
            {
                await MigrateAndOptionallyUnlockAsync(services, seed: false);
            }
            catch (Exception ex)
            {
                dbState.DbPath = null;
                dbState.Password = null;
                dbState.SessionToken = null;
                Log.Error(ex, "Failed to open database: {Path}", path);
                return Results.Problem($"Failed to open database: {ex.Message}");
            }

            dbState.SessionToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

            // Save the credential if it was successfully unlocked and a password was used
            if (!string.IsNullOrEmpty(password))
            {
                CredentialManager.SaveCredential(path, password);
            }

            var config = LauncherConfig.Load();
            var name = Path.GetFileNameWithoutExtension(path);
            config.Touch(name, path);

            Log.Information("Opened database: {Path}", path);
            return Results.Ok(new { status = "READY", dbPath = path, sessionToken = dbState.SessionToken });
        });

        // ── POST /api/launcher/new ────────────────────────────────────────────
        // Creates a new database at the specified path. Runs migrations, but does not seed.
        app.MapPost("/api/launcher/new", async (
            NewDatabaseRequest req,
            DatabaseState dbState,
            IServiceProvider services) =>
        {
            if (string.IsNullOrWhiteSpace(req.DbPath))
                return Results.BadRequest("dbPath is required.");

            if (!ValidatePath(req.DbPath, out var path, out var error))
                return Results.BadRequest(error);

            var name = string.IsNullOrWhiteSpace(req.Name)
                ? Path.GetFileNameWithoutExtension(path)
                : req.Name.Trim();

            if (File.Exists(path))
                return Results.BadRequest($"A file already exists at: {path}. Use 'open' to open it.");

            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir))
            {
                try { Directory.CreateDirectory(dir); }
                catch (Exception ex) { return Results.BadRequest($"Cannot create directory: {ex.Message}"); }
            }

            // Also create the sibling folders expected by the app
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(Path.Combine(dir, "Backups"));
                Directory.CreateDirectory(Path.Combine(dir, "Images"));
                Directory.CreateDirectory(Path.Combine(dir, "Exports"));
            }

            dbState.DbPath = path;
            dbState.Password = req.Password;

            try
            {
                await MigrateAndOptionallyUnlockAsync(services, seed: false);

                // Add the StoreName setting to the database if it doesn't exist
                using var scope = services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var storeNameSetting = await db.Settings.FirstOrDefaultAsync(s => s.Key == "StoreName");
                if (storeNameSetting == null)
                {
                    db.Settings.Add(new Models.Setting { Key = "StoreName", Value = name });
                    await db.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                dbState.DbPath = null;
                dbState.Password = null;
                dbState.SessionToken = null;
                Log.Error(ex, "Failed to create database: {Path}", path);
                return Results.Problem($"Failed to create database: {ex.Message}");
            }

            dbState.SessionToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

            // Save the credential if database is successfully created with a password
            if (!string.IsNullOrEmpty(req.Password))
            {
                CredentialManager.SaveCredential(path, req.Password);
            }

            var config = LauncherConfig.Load();
            config.Touch(name, path);

            Log.Information("Created new database '{Name}' at {Path}", name, path);
            return Results.Ok(new { status = "READY", dbPath = path, name, sessionToken = dbState.SessionToken });
        });

        // ── POST /api/launcher/demo ───────────────────────────────────────────
        // Creates or opens the demo database and seeds it if newly created.
        app.MapPost("/api/launcher/demo", async (
            DatabaseState dbState,
            IServiceProvider services) =>
        {
            var configDir = Path.GetDirectoryName(LauncherConfig.ConfigFilePath);
            if (string.IsNullOrEmpty(configDir))
                return Results.Problem("Failed to determine application data directory.");

            var path = Path.Combine(configDir, "demo.db");
            var alreadyExists = File.Exists(path);

            if (!alreadyExists)
            {
                try { Directory.CreateDirectory(configDir); }
                catch (Exception ex) { return Results.BadRequest($"Cannot create directory: {ex.Message}"); }

                // Create the sibling folders expected by the app
                Directory.CreateDirectory(Path.Combine(configDir, "Backups"));
                Directory.CreateDirectory(Path.Combine(configDir, "Images"));
                Directory.CreateDirectory(Path.Combine(configDir, "Exports"));
            }

            dbState.DbPath = path;
            dbState.Password = null;

            try
            {
                // Seed only if it's newly created
                await MigrateAndOptionallyUnlockAsync(services, seed: !alreadyExists);
            }
            catch (Exception ex)
            {
                dbState.DbPath = null;
                dbState.Password = null;
                dbState.SessionToken = null;
                Log.Error(ex, "Failed to initialize demo database: {Path}", path);
                return Results.Problem($"Failed to initialize demo database: {ex.Message}");
            }

            dbState.SessionToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

            var config = LauncherConfig.Load();
            config.Touch("Demo Database", path);

            Log.Information("Initialized demo database at {Path}", path);
            return Results.Ok(new { status = "READY", dbPath = path, name = "Demo Database", sessionToken = dbState.SessionToken });
        });

        // ── POST /api/launcher/remove-recent ──────────────────────────────────────
        // Removes a database path from the list of recent databases (does not delete file)
        app.MapPost("/api/launcher/remove-recent", (RemoveRecentRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.DbPath))
                return Results.BadRequest("dbPath is required.");

            var config = LauncherConfig.Load();
            config.RecentDatabases.RemoveAll(r => string.Equals(r.Path, req.DbPath, StringComparison.OrdinalIgnoreCase));
            config.Save();

            Log.Information("Removed database reference: {Path}", req.DbPath);
            return Results.Ok(new { recentDatabases = config.RecentDatabases });
        });

        // ── POST /api/launcher/pick-file ──────────────────────────────────────────
        // Opens native OS dialog on local host (macOS or Windows) to pick a file.
        app.MapPost("/api/launcher/pick-file", async () =>
        {
            try
            {
                string? selectedPath = null;
                if (OperatingSystem.IsMacOS())
                {
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "osascript",
                        Arguments = "-e \"POSIX path of (choose file of type {\\\"db\\\"} with prompt \\\"Choose SQLite Database\\\")\"",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using var process = System.Diagnostics.Process.Start(psi);
                    if (process is not null)
                    {
                        await process.WaitForExitAsync();
                        if (process.ExitCode == 0)
                        {
                            selectedPath = (await process.StandardOutput.ReadToEndAsync()).Trim();
                        }
                    }
                }
                else if (OperatingSystem.IsWindows())
                {
                    var script = "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $g = New-Object System.Windows.Forms.OpenFileDialog; $g.Filter = 'Database Files (*.db)|*.db|All Files (*.*)|*.*'; $g.Title = 'Choose SQLite Database'; if($g.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $g.FileName }";
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{script}\"",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using var process = System.Diagnostics.Process.Start(psi);
                    if (process is not null)
                    {
                        await process.WaitForExitAsync();
                        if (process.ExitCode == 0)
                        {
                            selectedPath = (await process.StandardOutput.ReadToEndAsync()).Trim();
                        }
                    }
                }

                return Results.Ok(new { path = selectedPath });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to show local file dialog");
                return Results.Problem($"Failed to show dialog: {ex.Message}");
            }
        });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static bool ValidatePath(string rawPath, out string fullPath, out string error)
    {
        error = "";
        fullPath = "";

        if (string.IsNullOrWhiteSpace(rawPath))
        {
            error = "Path cannot be empty.";
            return false;
        }

        if (rawPath.Contains('\0') || rawPath.Contains(".."))
        {
            error = "Directory traversal or invalid characters detected.";
            return false;
        }

        try
        {
            fullPath = Path.GetFullPath(rawPath.Trim());
        }
        catch (Exception ex)
        {
            error = $"Invalid path: {ex.Message}";
            return false;
        }

        if (!Path.IsPathRooted(fullPath))
        {
            error = "Path must be absolute.";
            return false;
        }

        // Simple check for sensitive system directories
        var sensitivePaths = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            "/etc", "/bin", "/sbin", "/usr", "/var", "/root", "/boot"
        };

        foreach (var sp in sensitivePaths)
        {
            if (string.IsNullOrEmpty(sp)) continue;
            if (fullPath.StartsWith(sp, StringComparison.OrdinalIgnoreCase))
            {
                // Allow user's local app data even if it's under a sensitive root (unlikely but being safe)
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrEmpty(localAppData) && fullPath.StartsWith(localAppData, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                // If it's just the root (like C:\), we should be careful.
                // But usually we want to allow users to save anywhere except system folders.
                if (string.Equals(fullPath, sp, StringComparison.OrdinalIgnoreCase))
                {
                    error = $"Access to system directory '{sp}' is restricted.";
                    return false;
                }

                // If it's a subfolder of a system folder
                if (fullPath.Length > sp.Length && (fullPath[sp.Length] == Path.DirectorySeparatorChar || fullPath[sp.Length] == Path.AltDirectorySeparatorChar))
                {
                    error = $"Access to system directory '{sp}' is restricted.";
                    return false;
                }
            }
        }

        return true;
    }

    private static async Task MigrateAndOptionallyUnlockAsync(IServiceProvider services, bool seed)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        // Enable write-ahead logging and safe normal synchronizations for durability
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode = WAL;");
        await db.Database.ExecuteSqlRawAsync("PRAGMA synchronous = NORMAL;");

        // Periodic database maintenance check
        try
        {
            var lastMaintSetting = await db.Settings.FirstOrDefaultAsync(s => s.Key == "LastMaintenanceDate");
            bool runMaintenance = false;
            DateTime now = DateTime.UtcNow;

            if (lastMaintSetting == null)
            {
                runMaintenance = true;
                lastMaintSetting = new Models.Setting { Key = "LastMaintenanceDate", Value = now.ToString("o") };
                db.Settings.Add(lastMaintSetting);
                await db.SaveChangesAsync();
            }
            else if (DateTime.TryParse(lastMaintSetting.Value, out var lastMaintDate) && (now - lastMaintDate).TotalDays >= 7)
            {
                runMaintenance = true;
                lastMaintSetting.Value = now.ToString("o");
                await db.SaveChangesAsync();
            }

            if (runMaintenance)
            {
                Log.Information("Running scheduled database maintenance (VACUUM & ANALYZE)...");
                // Note: VACUUM cannot run within a transaction, so we make sure we are clean.
                await db.Database.ExecuteSqlRawAsync("VACUUM;");
                await db.Database.ExecuteSqlRawAsync("ANALYZE;");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to run periodic database maintenance check (non-fatal).");
        }

        if (seed)
        {
            var inv = scope.ServiceProvider.GetRequiredService<InventoryService>();
            await DbSeeder.SeedAsync(db, inv);
        }

        // Run the automated daily backup check (fire-and-forget on open)
        try
        {
            var backup = scope.ServiceProvider.GetRequiredService<BackupService>();
            var dbPath = backup.GetDatabaseFilePath();
            var backupsDir = Path.Combine(Path.GetDirectoryName(dbPath) ?? "", "Backups");
            bool shouldBackup = true;

            if (Directory.Exists(backupsDir))
            {
                var lastBackup = Directory.GetFiles(backupsDir, "*.db")
                    .Select(f => new FileInfo(f))
                    .OrderByDescending(fi => fi.CreationTimeUtc)
                    .FirstOrDefault();

                if (lastBackup != null && (DateTime.UtcNow - lastBackup.CreationTimeUtc).TotalHours < 24)
                    shouldBackup = false;
            }

            if (shouldBackup)
            {
                Log.Information("Creating automated daily backup...");
                await backup.CreateBackupAsync();
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Automated backup check failed (non-fatal).");
        }
    }
}

// ── request models ─────────────────────────────────────────────────────────────

public record OpenDatabaseRequest(string DbPath, string? Password);
public record NewDatabaseRequest(string DbPath, string? Name, string? Password);
public record ThemeRequest(string Theme);
public record RemoveRecentRequest(string DbPath);
