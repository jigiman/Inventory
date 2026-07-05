using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Features;
using Backend.Services;

namespace Backend;

public class Program
{
    public static async Task Main(string[] args)
    {
        var (app, _) = await StartAsync(args, 5000);
        await app.WaitForShutdownAsync();
    }

    public static async Task<(WebApplication App, string Address)> StartAsync(string[] args, int port = 0)
    {
        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console()
            .CreateLogger();

        var builder = WebApplication.CreateBuilder(args);
        builder.Host.UseSerilog();

        // Setup AppData paths
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), 
            "InventorySystem"
        );
        Directory.CreateDirectory(appDataPath);
        Directory.CreateDirectory(Path.Combine(appDataPath, "Backups"));
        Directory.CreateDirectory(Path.Combine(appDataPath, "Images"));
        Directory.CreateDirectory(Path.Combine(appDataPath, "Exports"));

        var dbPath = Path.Combine(appDataPath, "inventory.db");

        // Add DbContext
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite($"Data Source={dbPath}"));

        // Register core services
        builder.Services.AddScoped<InventoryService>();
        builder.Services.AddScoped<BackupService>();
        builder.Services.AddScoped<ExportService>();

        builder.Services.AddControllers().AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });
        builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
        {
            options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });
        builder.Services.AddOpenApi();
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            });
        });

        // Use custom local port
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

        var app = builder.Build();

        app.UseCors();
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseDefaultFiles();
        app.UseStaticFiles();

        app.MapControllers();
        app.MapFallbackToFile("index.html");

        // Register minimal API endpoints
        app.MapInventoryEndpoints();

        // Automatically run migrations on startup
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();

            // Seed database
            var invService = scope.ServiceProvider.GetRequiredService<InventoryService>();
            await DbSeeder.SeedAsync(db, invService);

            // Run automated daily backup check
            var backupService = scope.ServiceProvider.GetRequiredService<BackupService>();
            try
            {
                var targetDbPath = backupService.GetDatabaseFilePath();
                var targetDataPath = Path.GetDirectoryName(targetDbPath) ?? "";
                var backupsDir = Path.Combine(targetDataPath, "Backups");
                bool shouldBackup = true;

                if (Directory.Exists(backupsDir))
                {
                    var lastBackup = Directory.GetFiles(backupsDir, "*.db")
                        .Select(f => new FileInfo(f))
                        .OrderByDescending(fi => fi.CreationTimeUtc)
                        .FirstOrDefault();

                    if (lastBackup != null && (DateTime.UtcNow - lastBackup.CreationTimeUtc).TotalHours < 24)
                    {
                        shouldBackup = false;
                    }
                }

                if (shouldBackup)
                {
                    Log.Information("No backup found in last 24 hours. Creating automated daily backup...");
                    var backupPath = await backupService.CreateBackupAsync();
                    Log.Information("Automated daily backup created successfully: {Path}", backupPath);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to run automated daily backup check");
            }
        }

        await app.StartAsync();

        var address = app.Urls.FirstOrDefault() ?? $"http://127.0.0.1:{port}";
        return (app, address);
    }
}
