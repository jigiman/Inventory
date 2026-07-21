using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests;

public class ServicesTests : DbTestBase
{
    [Fact]
    public async Task InventoryService_RecordTransaction_And_FifoDeplete_Succeeds()
    {
        // Arrange
        var service = new InventoryService(DbContext);

        var category = new Category { Name = "TestCategory" };
        var brand = new Brand { Name = "TestBrand" };
        var unit = new Unit { Name = "TestUnit" };
        var supplier = new Supplier { Name = "TestSupplier" };

        DbContext.Categories.Add(category);
        DbContext.Brands.Add(brand);
        DbContext.Units.Add(unit);
        DbContext.Suppliers.Add(supplier);
        await DbContext.SaveChangesAsync();

        var product = new Product
        {
            SKU = "TEST-SKU-1",
            Name = "Test Product",
            CategoryId = category.Id,
            BrandId = brand.Id,
            UnitId = unit.Id,
            SupplierId = supplier.Id,
            CostPrice = 10.0m,
            SellingPrice = 15.0m,
            CurrentQuantity = 0
        };
        DbContext.Products.Add(product);
        await DbContext.SaveChangesAsync();

        // Act - Record a Purchase (qtyIn: 10)
        var tx1 = await service.RecordTransactionAsync(
            product.Id,
            "Purchase",
            qtyIn: 10,
            qtyOut: 0,
            reference: "PO-001",
            supplierId: supplier.Id,
            costPrice: 9.5m
        );

        // Assert tx1
        Assert.NotNull(tx1);
        Assert.Equal(10, tx1.QuantityIn);
        Assert.Equal(10, tx1.RemainingQuantity);
        Assert.Equal(10, tx1.RunningBalance);
        
        var productAfterTx1 = await DbContext.Products.FindAsync(product.Id);
        Assert.Equal(10, productAfterTx1.CurrentQuantity);

        // Act - Record another Purchase (qtyIn: 5)
        var tx2 = await service.RecordTransactionAsync(
            product.Id,
            "Purchase",
            qtyIn: 5,
            qtyOut: 0,
            reference: "PO-002",
            supplierId: supplier.Id,
            costPrice: 10.5m
        );

        // Assert tx2
        Assert.Equal(15, tx2.RunningBalance);

        // Act - Deplete Stock via FIFO (quantity: 12)
        var allocations = await service.DepleteStockFifoAsync(product.Id, 12);

        // Assert FIFO Allocations: 10 from first batch (9.5 cost), 2 from second batch (10.5 cost)
        Assert.Equal(2, allocations.Count);
        Assert.Equal(10, allocations[0].Quantity);
        Assert.Equal(9.5m, allocations[0].CostPrice);
        Assert.Equal(2, allocations[1].Quantity);
        Assert.Equal(10.5m, allocations[1].CostPrice);

        // Record a Sale to reflect the depletion
        await service.RecordTransactionAsync(
            product.Id,
            "Sale",
            qtyIn: 0,
            qtyOut: 12,
            reference: "SO-001"
        );
        var productAfterSale = await DbContext.Products.FindAsync(product.Id);
        Assert.Equal(3, productAfterSale.CurrentQuantity);

        // Act - Deplete remaining 3 plus 2 oversold (negative stock)
        var allocationsOver = await service.DepleteStockFifoAsync(product.Id, 5);
        // Assert: 3 from second batch (10.5 cost), 2 attributed to default cost (10.0m)
        Assert.Equal(2, allocationsOver.Count);
        Assert.Equal(3, allocationsOver[0].Quantity);
        Assert.Equal(10.5m, allocationsOver[0].CostPrice);
        Assert.Equal(2, allocationsOver[1].Quantity);
        Assert.Equal(10.0m, allocationsOver[1].CostPrice);
    }

    [Fact]
    public async Task CloudSyncService_DoesNotThrow_WhenFolderDoesNotExistOrIsEmpty()
    {
        var service = new CloudSyncService(DbContext);
        // Should not throw when file path is null/empty or file does not exist
        await service.SyncBackupAsync(null!);
        await service.SyncBackupAsync("non-existent-path.bak");

        // Set CloudSyncFolder to a temporary path that does not exist
        DbContext.Settings.Add(new Setting { Key = "CloudSyncFolder", Value = "/invalid/non-existent-path/sync" });
        await DbContext.SaveChangesAsync();

        var tempFile = Path.Combine(Path.GetTempPath(), $"temp_backup_{Guid.NewGuid():N}.bak");
        File.WriteAllText(tempFile, "dummy content");

        try
        {
            await service.SyncBackupAsync(tempFile);
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task CloudSyncService_SyncsSuccessfully_WhenFolderExists()
    {
        var service = new CloudSyncService(DbContext);
        var syncDir = Path.Combine(Path.GetTempPath(), $"sync_dir_{Guid.NewGuid():N}");
        Directory.CreateDirectory(syncDir);

        DbContext.Settings.Add(new Setting { Key = "CloudSyncFolder", Value = syncDir });
        await DbContext.SaveChangesAsync();

        var tempFile = Path.Combine(Path.GetTempPath(), $"temp_backup_{Guid.NewGuid():N}.bak");
        File.WriteAllText(tempFile, "backup file content");

        try
        {
            await service.SyncBackupAsync(tempFile);
            var destPath = Path.Combine(syncDir, Path.GetFileName(tempFile));
            Assert.True(File.Exists(destPath));
            Assert.Equal("backup file content", File.ReadAllText(destPath));
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
            if (Directory.Exists(syncDir)) Directory.Delete(syncDir, true);
        }
    }

    [Fact]
    public async Task DbIntegrityService_RunsIntegrityCheck_Successfully()
    {
        var service = new DbIntegrityService(DbContext);
        var result = await service.RunIntegrityCheckAsync();
        Assert.True(result.Passed);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ExportService_ExportsCsvExcelPdf_WithoutErrors()
    {
        var service = new ExportService();
        var headers = new List<string> { "SKU", "Name", "Qty" };
        var rows = new List<List<string>>
        {
            new() { "SKU1", "Prod 1", "10" },
            new() { "SKU2", "Prod 2", "5" }
        };

        var csv = service.ExportToCsv(headers, rows);
        Assert.NotEmpty(csv);

        var excel = service.ExportToExcel("Sheet1", headers, rows);
        Assert.NotEmpty(excel);

        var pdf = service.ExportToPdf("Test Title", headers, rows);
        Assert.NotEmpty(pdf);
    }

    [Fact]
    public void DatabaseState_ConnectionString_Throws_IfNotInitialized()
    {
        var dbState = new DatabaseState();
        Assert.Throws<InvalidOperationException>(() => dbState.ConnectionString);
    }
}
