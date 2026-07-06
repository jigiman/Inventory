using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.IO.Compression;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.Settings;

public static class SettingEndpoints
{
    public static void MapSettingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings", async (AppDbContext db) => 
            await db.Settings.ToListAsync());

        app.MapPost("/api/settings", async (AppDbContext db, Setting setting) =>
        {
            var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == setting.Key);
            if (existing != null)
            {
                existing.Value = setting.Value;
            }
            else
            {
                db.Settings.Add(setting);
            }
            await db.SaveChangesAsync();
            return Results.Ok(setting);
        }).AddEndpointFilter<ValidationFilter<Setting>>();

        app.MapGet("/api/backups", (AppDbContext db, BackupService bs) =>
        {
            var dbPath = bs.GetDatabaseFilePath();
            var appDataPath = Path.GetDirectoryName(dbPath) ?? "";
            var backupsDir = Path.Combine(appDataPath, "Backups");
            if (!Directory.Exists(backupsDir))
                return Results.Ok(new List<string>());

            var files = Directory.GetFiles(backupsDir, "*.*")
                .Where(f => f.EndsWith(".db", StringComparison.OrdinalIgnoreCase) ||
                            f.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) ||
                            f.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                .Select(Path.GetFileName)
                .ToList();
            return Results.Ok(files);
        });

        app.MapPost("/api/backups", async (BackupService bs) =>
        {
            var path = await bs.CreateBackupAsync();
            return Results.Ok(new { File = Path.GetFileName(path) });
        });

        app.MapPost("/api/backups/restore", async (BackupService bs, RestoreDto dto) =>
        {
            if (string.IsNullOrWhiteSpace(dto.FileName))
                return Results.BadRequest("FileName is required");

            await bs.RestoreBackupAsync(dto.FileName);
            return Results.Ok(new { Status = "Database restored successfully" });
        });

        app.MapGet("/api/diagnostics/export", async (BackupService bs) =>
        {
            var dbPath = bs.GetDatabaseFilePath();
            var appDataPath = Path.GetDirectoryName(dbPath) ?? "";
            var logsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InventorySystem", "Logs");

            var tempZipPath = Path.Combine(Path.GetTempPath(), $"diagnostics_{Guid.NewGuid()}.zip");
            try
            {
                using (var fs = new FileStream(tempZipPath, FileMode.Create))
                using (var archive = new System.IO.Compression.ZipArchive(fs, System.IO.Compression.ZipArchiveMode.Create))
                {
                    // Add app log files
                    if (Directory.Exists(logsDir))
                    {
                        var logFiles = Directory.GetFiles(logsDir, "*.txt");
                        foreach (var logFile in logFiles)
                        {
                            archive.CreateEntryFromFile(logFile, "Logs/" + Path.GetFileName(logFile));
                        }
                    }

                    // Add system diagnostic file
                    var diagEntry = archive.CreateEntry("diagnostics_report.txt");
                    using (var writer = new StreamWriter(diagEntry.Open()))
                    {
                        await writer.WriteLineAsync("Inventory System Diagnostics Report");
                        await writer.WriteLineAsync($"Generated: {DateTime.UtcNow} UTC");
                        await writer.WriteLineAsync($"OS Version: {System.Runtime.InteropServices.RuntimeInformation.OSDescription}");
                        await writer.WriteLineAsync($"Framework: {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}");
                        await writer.WriteLineAsync($"Machine Name: {Environment.MachineName}");
                        await writer.WriteLineAsync($"Processors: {Environment.ProcessorCount}");
                        
                        var dbFileInfo = new FileInfo(dbPath);
                        await writer.WriteLineAsync($"Database Path: {dbPath}");
                        await writer.WriteLineAsync($"Database Size: {dbFileInfo.Length} bytes");
                        await writer.WriteLineAsync($"Database Created: {dbFileInfo.CreationTimeUtc} UTC");
                        await writer.WriteLineAsync($"Database Last Write: {dbFileInfo.LastWriteTimeUtc} UTC");
                    }
                }

                var zipBytes = await File.ReadAllBytesAsync(tempZipPath);
                return Results.File(zipBytes, "application/zip", $"diagnostics_{DateTime.UtcNow:yyyyMMdd_HHmmss}.zip");
            }
            finally
            {
                if (File.Exists(tempZipPath))
                    File.Delete(tempZipPath);
            }
        });
    }
}

public class RestoreDto
{
    public string FileName { get; set; } = string.Empty;
}
