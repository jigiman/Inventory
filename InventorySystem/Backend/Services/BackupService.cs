using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;

namespace Backend.Services;

public class BackupService
{
    private readonly AppDbContext _context;
    private readonly DatabaseState _dbState;
    private readonly CloudSyncService _syncService;

    public BackupService(AppDbContext context, DatabaseState dbState, CloudSyncService syncService)
    {
        _context = context;
        _dbState = dbState;
        _syncService = syncService;
    }

    public string GetDatabaseFilePath()
    {
        var connStr = _context.Database.GetDbConnection().ConnectionString;
        var builder = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(connStr);
        return builder.DataSource ?? throw new InvalidOperationException("Could not extract database file path from connection string.");
    }

    public async Task<string> CreateBackupAsync()
    {
        var dbPath = GetDatabaseFilePath();
        if (!File.Exists(dbPath))
            throw new FileNotFoundException("Database file not found", dbPath);

        var appDataPath = Path.GetDirectoryName(dbPath) ?? throw new InvalidOperationException("Invalid database folder");
        var backupsDir = Path.Combine(appDataPath, "Backups");
        Directory.CreateDirectory(backupsDir);

        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var tempDbPath = Path.Combine(backupsDir, $"temp_db_{timestamp}.db");

        // 1. Perform safe online SQLite backup using VACUUM INTO
        var escapedPath = tempDbPath.Replace("'", "''");
#pragma warning disable EF1002
        await _context.Database.ExecuteSqlRawAsync($"VACUUM INTO '{escapedPath}'");
#pragma warning restore EF1002

        // 2. Compress the DB backup and Images directory
        var tempZipPath = Path.Combine(backupsDir, $"temp_zip_{timestamp}.zip");
        try
        {
            using (var fs = new FileStream(tempZipPath, FileMode.Create))
            using (var archive = new ZipArchive(fs, ZipArchiveMode.Create))
            {
                archive.CreateEntryFromFile(tempDbPath, "database.db");

                // Package the salt file if it exists
                var saltPath = dbPath + ".salt";
                if (File.Exists(saltPath))
                {
                    archive.CreateEntryFromFile(saltPath, "database.db.salt");
                }

                var imagesDir = Path.Combine(appDataPath, "Images");
                if (Directory.Exists(imagesDir))
                {
                    var imageFiles = Directory.GetFiles(imagesDir, "*", SearchOption.AllDirectories);
                    foreach (var imgFile in imageFiles)
                    {
                        var relativePath = Path.GetRelativePath(appDataPath, imgFile);
                        archive.CreateEntryFromFile(imgFile, relativePath);
                    }
                }
            }
        }
        finally
        {
            if (File.Exists(tempDbPath))
                File.Delete(tempDbPath);
        }

        // 3. Encrypt if database has a password
        string finalBackupPath;
        var password = _dbState.Password;
        if (!string.IsNullOrEmpty(password))
        {
            var encryptedBackupPath = Path.Combine(backupsDir, $"backup_{timestamp}.bak");
            try
            {
                EncryptFile(tempZipPath, encryptedBackupPath, password);
                finalBackupPath = encryptedBackupPath;
            }
            finally
            {
                if (File.Exists(tempZipPath))
                    File.Delete(tempZipPath);
            }
        }
        else
        {
            var plainBackupPath = Path.Combine(backupsDir, $"backup_{timestamp}.zip");
            File.Move(tempZipPath, plainBackupPath, overwrite: true);
            finalBackupPath = plainBackupPath;
        }

        // Perform automated dry-run validation on the created backup file
        try
        {
            await ValidateBackupFileAsync(finalBackupPath, password);
            Serilog.Log.Information("Backup file verified successfully (dry-run restore passed).");
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Backup verification failed! Deleting invalid backup file: {Path}", finalBackupPath);
            if (File.Exists(finalBackupPath))
                File.Delete(finalBackupPath);
            throw new InvalidOperationException($"Backup validation failed: {ex.Message}", ex);
        }

        // Sync backup to cloud folder if configured
        await _syncService.SyncBackupAsync(finalBackupPath);

        return finalBackupPath;
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

        // 1. Dry-run validate the backup file first before touching active database
        var password = _dbState.Password;
        await ValidateBackupFileAsync(backupPath, password);

        var tempZipPath = Path.Combine(appDataPath, "Backups", $"temp_restore_{Guid.NewGuid()}.zip");
        var tempFolder = Path.Combine(appDataPath, "Backups", $"temp_workspace_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempFolder);

        var tempDbPath = Path.Combine(tempFolder, "database.db");
        var tempSaltPath = Path.Combine(tempFolder, "database.db.salt");
        var isEncrypted = backupFileName.EndsWith(".bak", StringComparison.OrdinalIgnoreCase);

        if (isEncrypted)
        {
            if (string.IsNullOrEmpty(password))
                throw new InvalidOperationException("Cannot decrypt backup. Database password is not set.");

            DecryptFile(backupPath, tempZipPath, password);
        }
        else
        {
            File.Copy(backupPath, tempZipPath);
        }

        try
        {
            using (var fs = new FileStream(tempZipPath, FileMode.Open))
            using (var archive = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                // Extract to temp folder
                var dbEntry = archive.GetEntry("database.db");
                if (dbEntry != null)
                {
                    dbEntry.ExtractToFile(tempDbPath, overwrite: true);
                }

                var saltEntry = archive.GetEntry("database.db.salt");
                if (saltEntry != null)
                {
                    saltEntry.ExtractToFile(tempSaltPath, overwrite: true);
                }
            }

            // Close connection and copy over dbPath safely
            await _context.Database.CloseConnectionAsync();
            GC.Collect();
            GC.WaitForPendingFinalizers();

            var activeBackupDb = dbPath + ".bak_old";
            var activeBackupSalt = dbPath + ".salt.bak_old";

            if (File.Exists(activeBackupDb)) File.Delete(activeBackupDb);
            if (File.Exists(activeBackupSalt)) File.Delete(activeBackupSalt);

            try
            {
                // Rename active DB out of the way
                if (File.Exists(dbPath))
                    File.Move(dbPath, activeBackupDb);

                var saltPath = dbPath + ".salt";
                if (File.Exists(saltPath))
                    File.Move(saltPath, activeBackupSalt);

                // Move restored DB into place
                File.Move(tempDbPath, dbPath);
                if (File.Exists(tempSaltPath))
                    File.Move(tempSaltPath, saltPath);
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "Failed to swap restored database files atomically. Rolling back to original.");
                if (File.Exists(activeBackupDb))
                {
                    if (File.Exists(dbPath)) File.Delete(dbPath);
                    File.Move(activeBackupDb, dbPath);
                }
                var saltPath = dbPath + ".salt";
                if (File.Exists(activeBackupSalt))
                {
                    if (File.Exists(saltPath)) File.Delete(saltPath);
                    File.Move(activeBackupSalt, saltPath);
                }
                throw new InvalidOperationException("Atomic database restore swap failed, original database remains active.", ex);
            }
            finally
            {
                if (File.Exists(activeBackupDb)) File.Delete(activeBackupDb);
                if (File.Exists(activeBackupSalt)) File.Delete(activeBackupSalt);
            }

            // Extract images
            using (var fs = new FileStream(tempZipPath, FileMode.Open))
            using (var archive = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    if (entry.FullName.StartsWith("Images/", StringComparison.OrdinalIgnoreCase))
                    {
                        var targetPath = Path.Combine(appDataPath, entry.FullName);
                        var targetDir = Path.GetDirectoryName(targetPath);
                        if (!string.IsNullOrEmpty(targetDir))
                            Directory.CreateDirectory(targetDir);
                        
                        entry.ExtractToFile(targetPath, overwrite: true);
                    }
                }
            }
        }
        finally
        {
            if (File.Exists(tempZipPath))
                File.Delete(tempZipPath);
            if (Directory.Exists(tempFolder))
                Directory.Delete(tempFolder, recursive: true);
        }
    }

    private async Task ValidateBackupFileAsync(string backupPath, string? password)
    {
        var tempFolder = Path.Combine(Path.GetTempPath(), $"backup_val_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempFolder);

        var tempZip = Path.Combine(tempFolder, "temp.zip");
        var tempDb = Path.Combine(tempFolder, "temp.db");

        try
        {
            var isEncrypted = backupPath.EndsWith(".bak", StringComparison.OrdinalIgnoreCase);
            if (isEncrypted)
            {
                if (string.IsNullOrEmpty(password))
                    throw new InvalidOperationException("Password is required to decrypt backup.");
                DecryptFile(backupPath, tempZip, password);
            }
            else
            {
                File.Copy(backupPath, tempZip);
            }

            using (var fs = new FileStream(tempZip, FileMode.Open))
            using (var archive = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                var entry = archive.GetEntry("database.db");
                if (entry == null)
                    throw new InvalidDataException("Backup ZIP archive does not contain 'database.db'.");
                entry.ExtractToFile(tempDb, overwrite: true);

                var saltEntry = archive.GetEntry("database.db.salt");
                if (saltEntry != null)
                {
                    saltEntry.ExtractToFile(tempDb + ".salt", overwrite: true);
                }
            }

            var builder = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = tempDb
            };

            if (!string.IsNullOrEmpty(password))
            {
                var saltPath = tempDb + ".salt";
                byte[] salt;
                if (File.Exists(saltPath))
                {
                    salt = File.ReadAllBytes(saltPath);
                }
                else
                {
                    var originalDb = GetDatabaseFilePath();
                    var origSalt = originalDb + ".salt";
                    if (File.Exists(origSalt))
                        salt = File.ReadAllBytes(origSalt);
                    else
                        throw new FileNotFoundException("Salt file not found for verification.");
                }

                var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, HashAlgorithmName.SHA256, 32);
                builder.Password = $"x'{Convert.ToHexString(key)}'";
            }

            var connStr = builder.ToString();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connStr)
                .Options;

            using (var context = new AppDbContext(options))
            {
                var testQuery = await context.Settings.CountAsync();
            }
        }
        finally
        {
            if (Directory.Exists(tempFolder))
                Directory.Delete(tempFolder, recursive: true);
        }
    }

    private static void EncryptFile(string inputPath, string outputPath, string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, HashAlgorithmName.SHA256, 32);
        byte[] iv = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, HashAlgorithmName.SHA256, 16);

        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var outFs = new FileStream(outputPath, FileMode.Create);
        outFs.Write(salt, 0, salt.Length);
        outFs.Write(iv, 0, iv.Length);

        using var encryptor = aes.CreateEncryptor();
        using var cryptoStream = new CryptoStream(outFs, encryptor, CryptoStreamMode.Write);
        using var inFs = new FileStream(inputPath, FileMode.Open);
        inFs.CopyTo(cryptoStream);
    }

    private static void DecryptFile(string inputPath, string outputPath, string password)
    {
        using var inFs = new FileStream(inputPath, FileMode.Open);
        byte[] salt = new byte[16];
        byte[] iv = new byte[16];

        if (inFs.Read(salt, 0, salt.Length) != salt.Length || inFs.Read(iv, 0, iv.Length) != iv.Length)
            throw new InvalidDataException("Invalid backup file structure.");

        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, HashAlgorithmName.SHA256, 32);

        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        using var cryptoStream = new CryptoStream(inFs, decryptor, CryptoStreamMode.Read);
        using var outFs = new FileStream(outputPath, FileMode.Create);
        cryptoStream.CopyTo(outFs);
    }

    public void DeleteBackup(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ArgumentException("FileName is required", nameof(fileName));

        if (fileName.Contains("..") || Path.IsPathRooted(fileName))
            throw new ArgumentException("Invalid file name", nameof(fileName));

        var dbPath = GetDatabaseFilePath();
        var appDataPath = Path.GetDirectoryName(dbPath) ?? throw new InvalidOperationException("Invalid database folder");
        var backupsDir = Path.Combine(appDataPath, "Backups");
        var filePath = Path.Combine(backupsDir, fileName);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }
        else
        {
            throw new FileNotFoundException("Backup file not found", fileName);
        }
    }
}
