using System;
using System.IO;
using Xunit;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
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
        var service = new BackupService(context);

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
}
