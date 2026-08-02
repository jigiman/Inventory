using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Serilog;
using Velopack;
using Velopack.Sources;

namespace Backend.Services;

public class UpdateStatus
{
    public bool IsSupported { get; set; }
    public string CurrentVersion { get; set; } = "1.0.0";
    public bool UpdateAvailable { get; set; }
    public string? TargetVersion { get; set; }
    public string? ReleaseNotes { get; set; }
    public bool IsDownloaded { get; set; }
    public int DownloadProgress { get; set; }
    public string? Error { get; set; }
}

public class UpdateService
{
    private readonly IConfiguration _config;
    private UpdateInfo? _pendingUpdate;
    private bool _isDownloaded;
    private int _downloadProgress;

    public UpdateService(IConfiguration config)
    {
        _config = config;
    }

    public UpdateStatus GetStatus()
    {
        var mgr = CreateUpdateManager();
        var isSupported = mgr != null;
        var currentVer = mgr?.CurrentVersion?.ToString() ?? "1.0.0";

        return new UpdateStatus
        {
            IsSupported = isSupported,
            CurrentVersion = currentVer,
            UpdateAvailable = _pendingUpdate != null,
            TargetVersion = _pendingUpdate?.TargetFullRelease?.Version?.ToString(),
            IsDownloaded = _isDownloaded,
            DownloadProgress = _downloadProgress
        };
    }

    public async Task<UpdateStatus> CheckForUpdatesAsync()
    {
        var mgr = CreateUpdateManager();
        if (mgr == null)
        {
            return new UpdateStatus
            {
                IsSupported = false,
                Error = "Failed to initialize update manager."
            };
        }

        var status = GetStatus();

        try
        {
            Log.Information("Checking for updates via Velopack...");
            _pendingUpdate = await mgr.CheckForUpdatesAsync();

            if (_pendingUpdate != null)
            {
                status.UpdateAvailable = true;
                status.TargetVersion = _pendingUpdate.TargetFullRelease.Version.ToString();
                Log.Information("New update available: {Version}", status.TargetVersion);
            }
            else
            {
                status.UpdateAvailable = false;
                Log.Information("No new update available.");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error checking for updates.");
            status.Error = ex.Message;
        }

        return status;
    }

    public async Task<UpdateStatus> DownloadUpdateAsync(Action<int>? progressCallback = null)
    {
        var status = GetStatus();
        if (!status.IsSupported || _pendingUpdate == null)
        {
            status.Error = "No pending update to download.";
            return status;
        }

        var mgr = CreateUpdateManager();
        if (mgr == null)
        {
            status.Error = "Failed to initialize update manager.";
            return status;
        }

        try
        {
            _downloadProgress = 0;
            _isDownloaded = false;

            Log.Information("Downloading update {Version}...", _pendingUpdate.TargetFullRelease.Version);
            await mgr.DownloadUpdatesAsync(_pendingUpdate, progress =>
            {
                _downloadProgress = progress;
                progressCallback?.Invoke(progress);
            });

            _isDownloaded = true;
            status.IsDownloaded = true;
            status.DownloadProgress = 100;
            Log.Information("Update download complete.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error downloading update.");
            status.Error = ex.Message;
            _isDownloaded = false;
        }

        return status;
    }

    public void RestartAndApplyUpdate()
    {
        var mgr = CreateUpdateManager();
        if (mgr == null || _pendingUpdate == null || !_isDownloaded)
        {
            throw new InvalidOperationException("No downloaded update ready to apply.");
        }

        Log.Information("Applying update and restarting application...");
        mgr.ApplyUpdatesAndRestart(_pendingUpdate);
    }

    private UpdateManager? CreateUpdateManager()
    {
        try
        {
            var feedUrl = _config["Velopack:UpdateUrl"] 
                ?? _config["Velopack:GithubUrl"];

            if (string.IsNullOrWhiteSpace(feedUrl))
            {
                // Default fallback feed source (GitHub or static server placeholder)
                feedUrl = "https://github.com/jigiman/Inventory";
            }

            IUpdateSource source;
            if (feedUrl.Contains("github.com", StringComparison.OrdinalIgnoreCase))
            {
                source = new GithubSource(feedUrl, accessToken: null, prerelease: false);
            }
            else
            {
                source = new SimpleWebSource(feedUrl);
            }

            return new UpdateManager(source);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to create Velopack UpdateManager instance.");
            return null;
        }
    }
}
