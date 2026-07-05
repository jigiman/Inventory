using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Backend.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        var designTimeDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "InventorySystem"
        );
        Directory.CreateDirectory(designTimeDir);

        optionsBuilder.UseSqlite(
            $"Data Source={Path.Combine(designTimeDir, "design-time.db")}"
        );

        return new AppDbContext(optionsBuilder.Options);
    }
}
