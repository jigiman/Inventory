using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
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
        });

        app.MapGet("/api/backups", (AppDbContext db, BackupService bs) =>
        {
            var dbPath = bs.GetDatabaseFilePath();
            var appDataPath = Path.GetDirectoryName(dbPath) ?? "";
            var backupsDir = Path.Combine(appDataPath, "Backups");
            if (!Directory.Exists(backupsDir))
                return Results.Ok(new List<string>());

            var files = Directory.GetFiles(backupsDir, "*.db")
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
    }
}

public class RestoreDto
{
    public string FileName { get; set; } = string.Empty;
}
