using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;

namespace Backend.Services;

public class BackupService
{
    private readonly AppDbContext _context;

    public BackupService(AppDbContext context)
    {
        _context = context;
    }

    public string GetDatabaseFilePath()
    {
        var connStr = _context.Database.GetDbConnection().ConnectionString;
        // Extract connection source (e.g. Data Source=/path/to/db)
        var parts = connStr.Split('=', StringSplitOptions.TrimEntries);
        if (parts.Length > 1)
        {
            return parts[1];
        }
        throw new InvalidOperationException("Could not extract database file path from connection string.");
    }

    public async Task<string> CreateBackupAsync()
    {
        var dbPath = GetDatabaseFilePath();
        if (!File.Exists(dbPath))
            throw new FileNotFoundException("Database file not found", dbPath);

        var appDataPath = Path.GetDirectoryName(dbPath) ?? throw new InvalidOperationException("Invalid database folder");
        var backupsDir = Path.Combine(appDataPath, "Backups");
        Directory.CreateDirectory(backupsDir);

        var backupFileName = $"backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.db";
        var backupPath = Path.Combine(backupsDir, backupFileName);

        if (File.Exists(backupPath))
            File.Delete(backupPath);

        // Perform safe online SQLite backup using VACUUM INTO
        var escapedPath = backupPath.Replace("'", "''");
#pragma warning disable EF1002
        await _context.Database.ExecuteSqlRawAsync($"VACUUM INTO '{escapedPath}'");
#pragma warning restore EF1002

        return backupPath;
    }

    public async Task RestoreBackupAsync(string backupFileName)
    {
        if (Path.GetFileName(backupFileName) != backupFileName)
        {
            throw new ArgumentException("Invalid backup file name", nameof(backupFileName));
        }

        var dbPath = GetDatabaseFilePath();
        var appDataPath = Path.GetDirectoryName(dbPath) ?? throw new InvalidOperationException("Invalid database folder");
        var backupPath = Path.Combine(appDataPath, "Backups", backupFileName);

        if (!File.Exists(backupPath))
            throw new FileNotFoundException("Backup file not found", backupPath);

        // Close connection and copy over dbPath
        await _context.Database.CloseConnectionAsync();
        GC.Collect();
        GC.WaitForPendingFinalizers();

        File.Copy(backupPath, dbPath, overwrite: true);
    }
}
