using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace Performance.Tests;

public class PerformanceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly string _dbPath;
    private readonly ITestOutputHelper _output;

    public PerformanceTests(ITestOutputHelper output)
    {
        _output = output;
        _dbPath = $"perf_test_{Guid.NewGuid()}.db";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={_dbPath}")
            .Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }

    [Fact]
    public async Task SeedAndQueryLargeData()
    {
        const int productCount = 10000;
        const int transactionsPerProduct = 10;

        _output.WriteLine($"Seeding {productCount} products...");
        var sw = Stopwatch.StartNew();

        var category = new Category { Name = "Category" };
        var brand = new Brand { Name = "Brand" };
        var unit = new Unit { Name = "Unit" };
        var supplier = new Supplier { Name = "Supplier" };
        _db.Categories.Add(category);
        _db.Brands.Add(brand);
        _db.Units.Add(unit);
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();

        var products = new List<Product>();
        for (int i = 0; i < productCount; i++)
        {
            products.Add(new Product
            {
                SKU = $"SKU-{i:D6}",
                Name = $"Product {i}",
                CategoryId = category.Id,
                BrandId = brand.Id,
                UnitId = unit.Id,
                SupplierId = supplier.Id,
                CostPrice = 10.0m,
                SellingPrice = 20.0m,
                CurrentQuantity = transactionsPerProduct
            });
        }
        _db.Products.AddRange(products);
        await _db.SaveChangesAsync();
        _output.WriteLine($"Seeded products in {sw.ElapsedMilliseconds}ms");

        _output.WriteLine($"Seeding {productCount * transactionsPerProduct} transactions...");
        sw.Restart();
        var transactions = new List<StockTransaction>();
        for (int i = 0; i < productCount; i++)
        {
            for (int j = 0; j < transactionsPerProduct; j++)
            {
                transactions.Add(new StockTransaction
                {
                    ProductId = products[i].Id,
                    TransactionType = "Purchase",
                    QuantityIn = 1,
                    RunningBalance = j + 1,
                    TransactionDate = DateTime.UtcNow.AddMinutes(-i * j)
                });
            }
        }
        // Batch insert transactions
        _db.StockTransactions.AddRange(transactions);
        await _db.SaveChangesAsync();
        _output.WriteLine($"Seeded transactions in {sw.ElapsedMilliseconds}ms");

        // Test Dashboard Performance
        _output.WriteLine("Testing Dashboard Aggregation...");
        sw.Restart();
        var totalQty = await _db.Products.SumAsync(p => p.CurrentQuantity);
        var totalVal = await _db.Products.SumAsync(p => p.CurrentQuantity * p.CostPrice);
        var count = await _db.Products.CountAsync();
        _output.WriteLine($"Dashboard aggregations took {sw.ElapsedMilliseconds}ms");
        Assert.Equal(productCount * transactionsPerProduct, totalQty);
        Assert.Equal(productCount, count);

        // Test Pagination Performance
        _output.WriteLine("Testing Pagination...");
        sw.Restart();
        var page = 1;
        var pageSize = 50;
        var pagedItems = await _db.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        _output.WriteLine($"Pagination (page 1) took {sw.ElapsedMilliseconds}ms");
        Assert.Equal(pageSize, pagedItems.Count);

        sw.Restart();
        page = 100;
        pagedItems = await _db.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        _output.WriteLine($"Pagination (page 100) took {sw.ElapsedMilliseconds}ms");
        Assert.Equal(pageSize, pagedItems.Count);
    }
}
