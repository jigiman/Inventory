using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Photino.NET;
using Velopack;

namespace Desktop;

class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Velopack startup logic (installer / update hooks)
        VelopackApp.Build().Run();

        // Start ASP.NET Core Backend in background thread
        var backendPort = 0; // 0 lets OS select free port
        var backendTask = Backend.Program.StartAsync(args, backendPort);

        // Wait for backend to start and get address
        var (app, address) = backendTask.GetAwaiter().GetResult();

        // If environment variable is set to Development, point to Vite dev server (if running)
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var frontendUrl = address;
        if (env == "Development" && IsViteRunning())
        {
            frontendUrl = $"http://localhost:5173?backend={Uri.EscapeDataString(address)}&desktop=true";
        }
        else
        {
            frontendUrl = $"{address}?desktop=true";
        }

        var dbFilters = new (string name, string[] extensions)[]
        {
            ("SQLite Database", ["db"]),
            ("All Files", ["*"]),
        };

        var pdfFilters = new (string name, string[] extensions)[]
        {
            ("PDF Document", ["pdf"]),
            ("All Files", ["*"]),
        };

        var csvFilters = new (string name, string[] extensions)[]
        {
            ("CSV Document", ["csv"]),
            ("All Files", ["*"]),
        };

        var excelFilters = new (string name, string[] extensions)[]
        {
            ("Excel Document", ["xlsx"]),
            ("All Files", ["*"]),
        };

        PhotinoWindow? window = null;

        string? iconPath = null;
        var startDirs = new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() };
        foreach (var startDir in startDirs)
        {
            if (string.IsNullOrEmpty(startDir)) continue;
            var dir = startDir;
            while (!string.IsNullOrEmpty(dir))
            {
                var tryWebRoot = Path.Combine(dir, "wwwroot", "favicon.svg");
                if (File.Exists(tryWebRoot))
                {
                    iconPath = tryWebRoot;
                    break;
                }
                var tryBackendWebRoot = Path.Combine(dir, "Backend", "wwwroot", "favicon.svg");
                if (File.Exists(tryBackendWebRoot))
                {
                    iconPath = tryBackendWebRoot;
                    break;
                }
                var trySystemBackendWebRoot = Path.Combine(dir, "InventorySystem", "Backend", "wwwroot", "favicon.svg");
                if (File.Exists(trySystemBackendWebRoot))
                {
                    iconPath = trySystemBackendWebRoot;
                    break;
                }
                dir = Path.GetDirectoryName(dir);
            }
            if (iconPath != null) break;
        }

        window = new PhotinoWindow()
            .SetTitle("Single Store Inventory")
            .SetUseOsDefaultSize(false)
            .SetSize(1280, 800)
            .Center()
            .SetContextMenuEnabled(false);

        if (iconPath != null && OperatingSystem.IsWindows())
        {
            window.SetIconFile(iconPath);
        }

        window.RegisterWebMessageReceivedHandler(async (sender, message) =>
            {
                var win = (PhotinoWindow)sender;

                // Parse the incoming JSON message from the frontend
                FilePickMessage? msg = null;
                try { msg = JsonSerializer.Deserialize<FilePickMessage>(message); }
                catch { return; } // not a JSON message we handle

                if (msg is null) return;

                if (msg.Type == "save-file-data")
                {
                    try
                    {
                        var saveMsg = JsonSerializer.Deserialize<SaveFileDataMessage>(message);
                        if (saveMsg is not null && !string.IsNullOrEmpty(saveMsg.Path) && !string.IsNullOrEmpty(saveMsg.Base64Data))
                        {
                            var bytes = Convert.FromBase64String(saveMsg.Base64Data);
                            await File.WriteAllBytesAsync(saveMsg.Path, bytes);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Desktop] Save file data error: {ex.Message}");
                    }
                    return;
                }

                if (msg.Type != "pick-file") return;

                string? selectedPath = null;

                try
                {
                    if (msg.Mode == "open")
                    {
                        var files = await win.ShowOpenFileAsync(
                            title: "Open Database",
                            defaultPath: null,
                            multiSelect: false,
                            filters: dbFilters);
                        selectedPath = files?.Length > 0 ? files[0] : null;
                    }
                    else // "save"
                    {
                        var filters = dbFilters;
                        if (msg.FileType == "pdf") filters = pdfFilters;
                        else if (msg.FileType == "csv") filters = csvFilters;
                        else if (msg.FileType == "xlsx") filters = excelFilters;

                        var defaultName = msg.DefaultPath ?? "inventory.db";
                        string? defaultPath = null;
                        try
                        {
                            if (!string.IsNullOrEmpty(defaultName) && Path.IsPathRooted(defaultName))
                            {
                                defaultPath = Path.GetDirectoryName(defaultName);
                            }
                        }
                        catch
                        {
                            // ignore path format errors
                        }

                        selectedPath = await win.ShowSaveFileAsync(
                            title: "Save File As",
                            defaultPath: defaultPath,
                            filters: filters);

                        // Ensure proper extension if fileType is specified
                        if (selectedPath is not null && msg.FileType is not null)
                        {
                            var ext = $".{msg.FileType}";
                            if (!selectedPath.EndsWith(ext, StringComparison.OrdinalIgnoreCase))
                                selectedPath += ext;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[Desktop] File dialog error: {ex.Message}");
                }

                // Send result back to JS
                var response = JsonSerializer.Serialize(new
                {
                    type = "pick-file-result",
                    requestId = msg.RequestId,
                    path = selectedPath,
                });

                win.SendWebMessage(response);
            })
            .Load(new Uri(frontendUrl));

        window.WaitForClose();

        // Stop backend cleanly on close
        app.StopAsync().GetAwaiter().GetResult();
    }

    private static bool IsViteRunning()
    {
        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            var result = client.BeginConnect("localhost", 5173, null, null);
            var success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(200));
            if (success)
            {
                client.EndConnect(result);
                return true;
            }
            return false;
        }
        catch
        {
            return false;
        }
    }
}

/// <summary>Shape of the JSON message sent by the frontend when requesting a file dialog.</summary>
internal sealed record FilePickMessage(
    [property: System.Text.Json.Serialization.JsonPropertyName("type")]        string Type,
    [property: System.Text.Json.Serialization.JsonPropertyName("mode")]        string Mode,
    [property: System.Text.Json.Serialization.JsonPropertyName("requestId")]   string RequestId,
    [property: System.Text.Json.Serialization.JsonPropertyName("defaultPath")] string? DefaultPath = null,
    [property: System.Text.Json.Serialization.JsonPropertyName("fileType")]    string? FileType = null
);

/// <summary>Shape of the JSON message sent by the frontend containing base64 data to write to disk.</summary>
internal sealed record SaveFileDataMessage(
    [property: System.Text.Json.Serialization.JsonPropertyName("type")]       string Type,
    [property: System.Text.Json.Serialization.JsonPropertyName("path")]       string Path,
    [property: System.Text.Json.Serialization.JsonPropertyName("base64Data")] string Base64Data
);
