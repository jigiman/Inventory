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
        // Returns current status + list of recently used databases.
        app.MapGet("/api/launcher", (DatabaseState state) =>
        {
            var config = LauncherConfig.Load();
            return Results.Ok(new
            {
                status = state.IsInitialized ? "READY" : "NOT_INITIALIZED",
                recentDatabases = config.RecentDatabases
            });
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

            var path = Path.GetFullPath(req.DbPath.Trim());

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

            var path = Path.GetFullPath(req.DbPath.Trim());
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
