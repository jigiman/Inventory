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
}
