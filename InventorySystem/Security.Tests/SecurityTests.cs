using System;
using System.IO;
using Xunit;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Features;
using System.Threading.Tasks;

namespace Security.Tests;

public class SecurityTests
{
    [Fact]
    public async Task RestoreBackupAsync_ThrowsException_OnPathTraversal()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        using var context = new AppDbContext(options);
        var dbState = new DatabaseState();
        var syncService = new CloudSyncService(context);
        var service = new BackupService(context, dbState, syncService);

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => service.RestoreBackupAsync("../traversal.db"));
        await Assert.ThrowsAsync<ArgumentException>(() => service.RestoreBackupAsync("sub/folder.db"));
    }

    [Fact]
    public void Path_Replace_EscapesSingleQuotes()
    {
        // This tests the logic used in CreateBackupAsync for SQL injection prevention
        var path = "C:\\Backups\\backup's.db";
        var escapedPath = path.Replace("'", "''");
        Assert.Equal("C:\\Backups\\backup''s.db", escapedPath);
    }

    [Fact]
    public async Task VacuumInto_OnEncryptedDatabase_PreservesEncryption()
    {
        // Arrange
        var dbPath = "test_encrypted_source.db";
        var backupPath = "test_encrypted_backup.db";
        var password = "testpassword";

        if (File.Exists(dbPath)) File.Delete(dbPath);
        if (File.Exists(backupPath)) File.Delete(backupPath);

        try
        {
            var connectionString = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = dbPath,
                Password = password
            }.ToString();

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connectionString)
                .Options;

            using (var context = new AppDbContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                // Execute VACUUM INTO
                await context.Database.ExecuteSqlRawAsync($"VACUUM INTO '{backupPath}'");
            }

            // Assert: try to open backup without password - should fail
            var backupConnStrNoPass = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = backupPath
            }.ToString();

            var backupOptionsNoPass = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(backupConnStrNoPass)
                .Options;

            using (var backupContext = new AppDbContext(backupOptionsNoPass))
            {
                // SQLCipher usually throws when the first query is executed on an encrypted DB without the key
                await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(() => backupContext.Products.ToListAsync());
            }

            // Assert: try to open backup WITH password - should succeed
            var backupConnStrWithPass = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = backupPath,
                Password = password
            }.ToString();

            var backupOptionsWithPass = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(backupConnStrWithPass)
                .Options;

            using (var backupContext = new AppDbContext(backupOptionsWithPass))
            {
                var products = await backupContext.Products.ToListAsync();
                Assert.Empty(products);
            }
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
            if (File.Exists(backupPath)) File.Delete(backupPath);
        }
    }

    [Fact]
    public void CredentialManager_Save_Get_Delete_Succeeds()
    {
        if (!OperatingSystem.IsMacOS() && !OperatingSystem.IsWindows())
            return;

        var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".db");
        var testPassword = "MySuperSecretPassword123!";

        try
        {
            var saved = CredentialManager.SaveCredential(tempPath, testPassword);
            Assert.True(saved);

            var retrieved = CredentialManager.GetCredential(tempPath);
            Assert.Equal(testPassword, retrieved);

            var deleted = CredentialManager.DeleteCredential(tempPath);
            Assert.True(deleted);

            var retrievedPostDelete = CredentialManager.GetCredential(tempPath);
            Assert.Null(retrievedPostDelete);
        }
        finally
        {
            CredentialManager.DeleteCredential(tempPath);
        }
    }

    [Fact]
    public async Task BackupService_EncryptedBackup_And_Restore_Succeeds()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".db");
        var password = "test-backup-password";

        if (File.Exists(dbPath)) File.Delete(dbPath);

        try
        {
            var dbState = new DatabaseState
            {
                DbPath = dbPath,
                Password = password
            };

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(dbState.ConnectionString)
                .Options;

            using (var context = new AppDbContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                context.Settings.Add(new Setting { Key = "TestKey", Value = "TestValue" });
                await context.SaveChangesAsync();
            }

            string backupFile;
            using (var context = new AppDbContext(options))
            {
                var syncService = new CloudSyncService(context);
                var backupService = new BackupService(context, dbState, syncService);
                backupFile = await backupService.CreateBackupAsync();
                
                Assert.True(File.Exists(backupFile));
                Assert.EndsWith(".bak", backupFile);
                await context.Database.CloseConnectionAsync();
            }

            File.Delete(dbPath);

            using (var context = new AppDbContext(options))
            {
                var syncService = new CloudSyncService(context);
                var backupService = new BackupService(context, dbState, syncService);
                var backupFileName = Path.GetFileName(backupFile);
                
                await backupService.RestoreBackupAsync(backupFileName);

                var setting = await context.Settings.FirstOrDefaultAsync(s => s.Key == "TestKey");
                Assert.NotNull(setting);
                Assert.Equal("TestValue", setting.Value);
            }

            if (File.Exists(backupFile))
                File.Delete(backupFile);
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
            var saltPath = dbPath + ".salt";
            if (File.Exists(saltPath)) File.Delete(saltPath);
        }
    }

    [Fact]
    public void LauncherConfig_PathEncryption_Succeeds()
    {
        var originalPath = "/Users/test/inventory_secret_path.db";
        var encrypted = PersistentSecurity.Encrypt(originalPath);
        Assert.NotEqual(originalPath, encrypted);

        var decrypted = PersistentSecurity.Decrypt(encrypted);
        Assert.Equal(originalPath, decrypted);
    }

    [Fact]
    public async Task DbIntegrityService_VerifyChecks_SucceedsOnHealthyDb()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".db");
        if (File.Exists(dbPath)) File.Delete(dbPath);

        try
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite($"Data Source={dbPath}")
                .Options;

            using (var context = new AppDbContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                var integrityService = new DbIntegrityService(context);
                
                var checkResult = await integrityService.RunIntegrityCheckAsync();
                
                Assert.True(checkResult.Passed);
                Assert.Empty(checkResult.Errors);
            }
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }
}
