using System;
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

        // If environment variable is set to Development, we can point to Vite dev server
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var frontendUrl = address;
        if (env == "Development")
        {
            frontendUrl = $"http://localhost:5173?backend={Uri.EscapeDataString(address)}";
        }

        var window = new PhotinoWindow()
            .SetTitle("Single-Store Inventory Management System")
            .SetUseOsDefaultSize(false)
            .SetSize(1280, 800)
            .Center()
            .Load(new Uri(frontendUrl));

        window.WaitForClose();
        
        // Stop backend cleanly on close
        app.StopAsync().GetAwaiter().GetResult();
    }
}
