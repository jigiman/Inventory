using System;
using System.IO;
using Backend.Data;
using Backend.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

public class DbTestBase : IDisposable
{
    protected readonly string DbPath;
    protected readonly DatabaseState DbState;
    protected readonly AppDbContext DbContext;

    private static Microsoft.EntityFrameworkCore.Metadata.IModel? _cachedModel;

    public DbTestBase()
    {
        DbPath = Path.Combine(Path.GetTempPath(), $"test_db_{Guid.NewGuid():N}.db");
        DbState = new DatabaseState
        {
            DbPath = DbPath,
            SessionToken = "test-token"
        };

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(DbState.ConnectionString);

        if (_cachedModel != null)
        {
            optionsBuilder.UseModel(_cachedModel);
        }

        DbContext = new AppDbContext(optionsBuilder.Options);
        
        if (_cachedModel == null)
        {
            _cachedModel = DbContext.Model;
        }

        DbContext.Database.EnsureCreated();
    }

    public void Dispose()
    {
        DbContext.Dispose();
        
        try
        {
            if (File.Exists(DbPath))
            {
                File.Delete(DbPath);
            }
            var saltPath = DbPath + ".salt";
            if (File.Exists(saltPath))
            {
                File.Delete(saltPath);
            }
        }
        catch
        {
            // Ignore clean up errors
        }
    }
}
