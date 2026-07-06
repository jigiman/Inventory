using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
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
        // ── AppData directories ───────────────────────────────────────────────
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "InventorySystem"
        );
        Directory.CreateDirectory(appDataPath);

        // Initialize SQLCipher provider raw library
        SQLitePCL.Batteries_V2.Init();

        Log.Logger = new LoggerConfiguration()
            .WriteTo.Console()
            .WriteTo.File(
                Path.Combine(appDataPath, "Logs", "log-.txt"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
            )
            .CreateLogger();

        var builder = WebApplication.CreateBuilder(args);
        builder.Host.UseSerilog();

        // ── DatabaseState singleton ───────────────────────────────────────────
        // Holds the runtime-selected database path. Set by launcher endpoints.
        builder.Services.AddSingleton<DatabaseState>();

        // ── DbContext — configured lazily via DatabaseState ───────────────────
        // Options are evaluated per-scope so changing DatabaseState.DbPath is
        // picked up by the next request scope automatically.
        builder.Services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var state = sp.GetRequiredService<DatabaseState>();
            if (state.IsInitialized)
            {
                options.UseSqlite(state.ConnectionString)
                       .AddInterceptors(new SqliteImmediateTransactionInterceptor());
            }
        });

        // ── Core services ─────────────────────────────────────────────────────
        builder.Services.AddScoped<CloudSyncService>();
        builder.Services.AddScoped<InventoryService>();
        builder.Services.AddScoped<BackupService>();
        builder.Services.AddScoped<ExportService>();

        builder.Services.AddControllers().AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.ReferenceHandler =
                System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });
        builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
        {
            options.SerializerOptions.ReferenceHandler =
                System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        });
        builder.Services.AddOpenApi();
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
                policy.WithOrigins("http://localhost:5173", "http://127.0.0.1")
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });

        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

        var app = builder.Build();

        app.UseCors();

        if (app.Environment.IsDevelopment())
            app.MapOpenApi();

        // ── Guard middleware ──────────────────────────────────────────────────
        // Returns 503 for any non-launcher API call until the DB is initialized.
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? "";
            bool isLauncherPath = path.StartsWith("/api/launcher", StringComparison.OrdinalIgnoreCase);
            bool isApiPath = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);

            if (isApiPath && !isLauncherPath)
            {
                var state = context.RequestServices.GetRequiredService<DatabaseState>();
                if (!state.IsInitialized)
                {
                    context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "NOT_INITIALIZED",
                        message = "Database has not been selected yet. Use the launcher to open or create a database."
                    });
                    return;
                }
            }

            await next(context);
        });

        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.MapControllers();
        app.MapFallbackToFile("index.html");

        // Register all endpoints
        app.MapLauncherEndpoints();
        app.MapInventoryEndpoints();

        await app.StartAsync();

        var address = app.Urls.FirstOrDefault() ?? $"http://127.0.0.1:{port}";
        Log.Information("Backend started at {Address}", address);
        return (app, address);
    }
}
