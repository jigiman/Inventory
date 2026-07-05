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
                theme = config.Theme
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

            dbState.DbPath = path;

            try
            {
                await MigrateAndOptionallyUnlockAsync(services, seed: false);
            }
            catch (Exception ex)
            {
                dbState.DbPath = null;
                Log.Error(ex, "Failed to open database: {Path}", path);
                return Results.Problem($"Failed to open database: {ex.Message}");
            }

            var config = LauncherConfig.Load();
            var name = Path.GetFileNameWithoutExtension(path);
            config.Touch(name, path);

            Log.Information("Opened database: {Path}", path);
            return Results.Ok(new { status = "READY", dbPath = path });
        });

        // ── POST /api/launcher/new ────────────────────────────────────────────
        // Creates a new database at the specified path. Runs migrations + seed.
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

            try
            {
                await MigrateAndOptionallyUnlockAsync(services, seed: true);
            }
            catch (Exception ex)
            {
                dbState.DbPath = null;
                Log.Error(ex, "Failed to create database: {Path}", path);
                return Results.Problem($"Failed to create database: {ex.Message}");
            }

            var config = LauncherConfig.Load();
            config.Touch(name, path);

            Log.Information("Created new database '{Name}' at {Path}", name, path);
            return Results.Ok(new { status = "READY", dbPath = path, name });
        });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static bool ValidatePath(string rawPath, out string fullPath, out string error)
    {
        error = "";
        fullPath = "";

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
            Path.GetPathRoot(Environment.SystemDirectory), // e.g. C:\
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

public record OpenDatabaseRequest(string DbPath);
public record NewDatabaseRequest(string DbPath, string? Name);
public record ThemeRequest(string Theme);
