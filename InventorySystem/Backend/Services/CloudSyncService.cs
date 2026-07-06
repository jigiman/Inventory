using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;

namespace Backend.Services;

public class CloudSyncService
{
    private readonly AppDbContext _context;

    public CloudSyncService(AppDbContext context)
    {
        _context = context;
    }

    public async Task SyncBackupAsync(string backupFilePath)
    {
        if (string.IsNullOrEmpty(backupFilePath) || !File.Exists(backupFilePath))
            return;

        try
        {
            var syncFolderSetting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "CloudSyncFolder");

            if (syncFolderSetting != null && !string.IsNullOrWhiteSpace(syncFolderSetting.Value))
            {
                var syncDir = syncFolderSetting.Value.Trim();
                if (Directory.Exists(syncDir))
                {
                    var destFileName = Path.GetFileName(backupFilePath);
                    var destFilePath = Path.Combine(syncDir, destFileName);
                    
                    Serilog.Log.Information("Syncing backup file to cloud folder: {Path}", destFilePath);
                    File.Copy(backupFilePath, destFilePath, overwrite: true);
                }
                else
                {
                    Serilog.Log.Warning("Configured CloudSyncFolder does not exist: {Path}", syncDir);
                }
            }
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to sync backup to cloud folder.");
        }
    }
}
