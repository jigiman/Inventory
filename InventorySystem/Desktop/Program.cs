using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Photino.NET;

namespace Desktop;

class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Start ASP.NET Core Backend in background thread
        var backendPort = 0; // 0 lets OS select free port
        var backendTask = Backend.Program.StartAsync(args, backendPort);

        // Wait for backend to start and get address
        var (app, address) = backendTask.GetAwaiter().GetResult();

        // If environment variable is set to Development, point to Vite dev server
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var frontendUrl = address;
        if (env == "Development")
        {
            frontendUrl = $"http://localhost:5173?backend={Uri.EscapeDataString(address)}";
        }

        var dbFilters = new (string name, string[] extensions)[]
        {
            ("SQLite Database", ["db"]),
            ("All Files", ["*"]),
        };

        PhotinoWindow? window = null;

        window = new PhotinoWindow()
            .SetTitle("Single-Store Inventory Management System")
            .SetUseOsDefaultSize(false)
            .SetSize(1280, 800)
            .Center()
            .RegisterWebMessageReceivedHandler(async (sender, message) =>
            {
                var win = (PhotinoWindow)sender;

                // Parse the incoming JSON message from the frontend
                FilePickMessage? msg = null;
                try { msg = JsonSerializer.Deserialize<FilePickMessage>(message); }
                catch { return; } // not a JSON message we handle

                if (msg is null || msg.Type != "pick-file") return;

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
                        selectedPath = await win.ShowSaveFileAsync(
                            title: "Save New Database As",
                            defaultPath: "inventory.db",
                            filters: dbFilters);

                        // Ensure .db extension
                        if (selectedPath is not null && !selectedPath.EndsWith(".db", StringComparison.OrdinalIgnoreCase))
                            selectedPath += ".db";
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
}

/// <summary>Shape of the JSON message sent by the frontend when requesting a file dialog.</summary>
internal sealed record FilePickMessage(
    [property: System.Text.Json.Serialization.JsonPropertyName("type")]      string Type,
    [property: System.Text.Json.Serialization.JsonPropertyName("mode")]      string Mode,
    [property: System.Text.Json.Serialization.JsonPropertyName("requestId")] string RequestId
);
