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
        if (port == 0)
        {
            using var socket = new System.Net.Sockets.Socket(
                System.Net.Sockets.AddressFamily.InterNetwork,
                System.Net.Sockets.SocketType.Stream,
                System.Net.Sockets.ProtocolType.Tcp);
            socket.Bind(new System.Net.IPEndPoint(System.Net.IPAddress.Loopback, 0));
            port = ((System.Net.IPEndPoint)socket.LocalEndPoint!).Port;
        }

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

        // Pre-resolve the WebRootPath before creating the builder to avoid post-init modifications
        string? resolvedWebRoot = null;
        var defaultContentRoot = Directory.GetCurrentDirectory();
        var defaultWebRoot = Path.Combine(defaultContentRoot, "wwwroot");

        if (Directory.Exists(defaultWebRoot))
        {
            resolvedWebRoot = defaultWebRoot;
        }
        else
        {
            var startDirs = new[] { AppContext.BaseDirectory, defaultContentRoot };
            foreach (var startDir in startDirs)
            {
                if (string.IsNullOrEmpty(startDir)) continue;

                var dir = startDir;
                while (!string.IsNullOrEmpty(dir))
                {
                    var tryWebRoot = Path.Combine(dir, "wwwroot");
                    if (Directory.Exists(tryWebRoot))
                    {
                        resolvedWebRoot = tryWebRoot;
                        break;
                    }
                    var tryBackendWebRoot = Path.Combine(dir, "Backend", "wwwroot");
                    if (Directory.Exists(tryBackendWebRoot))
                    {
                        resolvedWebRoot = tryBackendWebRoot;
                        break;
                    }
                    var trySystemBackendWebRoot = Path.Combine(dir, "InventorySystem", "Backend", "wwwroot");
                    if (Directory.Exists(trySystemBackendWebRoot))
                    {
                        resolvedWebRoot = trySystemBackendWebRoot;
                        break;
                    }
                    dir = Path.GetDirectoryName(dir);
                }
                if (resolvedWebRoot != null)
                {
                    break;
                }
            }
        }

        WebApplicationBuilder builder;
        if (resolvedWebRoot != null)
        {
            builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                Args = args,
                WebRootPath = resolvedWebRoot
            });
        }
        else
        {
            builder = WebApplication.CreateBuilder(args);
        }

        // Configure serving static files from embedded resources
        builder.Environment.WebRootFileProvider = new Microsoft.Extensions.FileProviders.ManifestEmbeddedFileProvider(
            typeof(Program).Assembly, "wwwroot");

        builder.Host.UseSerilog();

        // Load embedded appsettings.json configuration
        var assembly = typeof(Program).Assembly;
        using (var stream = assembly.GetManifestResourceStream("Backend.appsettings.json"))
        {
            if (stream != null)
            {
                builder.Configuration.AddJsonStream(stream);
            }
        }

        // Disable environment fonts to force QuestPDF to use our explicitly registered embedded fonts
        // Disable environment fonts on Windows to force QuestPDF to use explicitly registered embedded fonts.
        // On macOS/Linux, skip this override to prevent native CoreText/AppKit font registration crashes.
        if (OperatingSystem.IsWindows())
        {
            QuestPDF.Settings.UseEnvironmentFonts = false;
            var fontResources = new[]
            {
                "Backend.LatoFont.Lato-Regular.ttf",
                "Backend.LatoFont.Lato-Bold.ttf",
                "Backend.LatoFont.Lato-SemiBold.ttf"
            };
            foreach (var fontName in fontResources)
            {
                using var stream = assembly.GetManifestResourceStream(fontName);
                if (stream != null)
                {
                    QuestPDF.Drawing.FontManager.RegisterFont(stream);
                }
            }
        }

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
        builder.Services.AddSingleton<UpdateService>();
        builder.Services.AddScoped<CloudSyncService>();
        builder.Services.AddScoped<DbIntegrityService>();
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
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
                policy.WithOrigins("http://localhost:5173", "https://localhost:5173", "http://127.0.0.1", "https://127.0.0.1")
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });
        builder.Services.AddOpenApi();

        builder.WebHost.UseUrls($"http://localhost:{port}");
        builder.WebHost.ConfigureKestrel(options => options.AllowSynchronousIO = true);

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
            bool isUpdaterPath = path.StartsWith("/api/updater", StringComparison.OrdinalIgnoreCase);
            bool isApiPath = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);

            if (isApiPath && !isLauncherPath && !isUpdaterPath)
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

                // Enforce Session Token verification for local API protection
                var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                var token = authHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                    ? authHeader.Substring(7)
                    : context.Request.Query["token"].FirstOrDefault();

                var expectedToken = state.SessionToken;
                if (string.IsNullOrEmpty(expectedToken) || 
                    string.IsNullOrEmpty(token) || 
                    token != expectedToken)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "UNAUTHORIZED",
                        message = "Invalid or missing session authorization token."
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
        app.MapUpdateEndpoints();

        await app.StartAsync();

        var address = app.Urls.FirstOrDefault() ?? $"http://localhost:{port}";
        Log.Information("Backend started at {Address}", address);
        return (app, address);
    }
}
