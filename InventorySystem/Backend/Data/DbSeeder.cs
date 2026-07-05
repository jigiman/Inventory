using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Models;
using Backend.Services;

namespace Backend.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, InventoryService invService)
    {
        // Only seed if database is empty of products
        if (await db.Products.AnyAsync())
            return;

        // 1. Categories
        var categories = new List<Category>
        {
            new() { Name = "Electronics", IsArchived = false },
            new() { Name = "Furniture", IsArchived = false },
            new() { Name = "Office Supplies", IsArchived = false }
        };
        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        // 2. Brands
        var brands = new List<Brand>
        {
            new() { Name = "TechGiant", IsArchived = false },
            new() { Name = "ComfortSeat", IsArchived = false },
            new() { Name = "OfficePro", IsArchived = false }
        };
        db.Brands.AddRange(brands);
        await db.SaveChangesAsync();

        // 3. Units
        var units = new List<Unit>
        {
            new() { Name = "Pcs" },
            new() { Name = "Box" }
        };
        db.Units.AddRange(units);
        await db.SaveChangesAsync();

        // 4. Suppliers
        var suppliers = new List<Supplier>
        {
            new() { Name = "Global Tech Distrib", ContactPerson = "John Doe", Phone = "+15550100", Email = "sales@globaltech.com", Address = "100 Silicon Valley", Notes = "Main tech supplier" },
            new() { Name = "Modern Furniture Wholesale", ContactPerson = "Jane Smith", Phone = "+15550200", Email = "info@modernfurn.com", Address = "200 Industrial Pkwy", Notes = "Furniture supplier" },
            new() { Name = "Stationery Hub Ltd", ContactPerson = "Bob Johnson", Phone = "+15550300", Email = "orders@stationeryhub.com", Address = "300 Paper Ave", Notes = "Office supplies supplier" }
        };
        db.Suppliers.AddRange(suppliers);
        await db.SaveChangesAsync();

        // 5. Products
        var products = new List<Product>
        {
            new()
            {
                SKU = "TG-LAP-001",
                Name = "TechGiant Laptop 15\"",
                Description = "High performance developer laptop",
                CategoryId = categories[0].Id,
                BrandId = brands[0].Id,
                UnitId = units[0].Id,
                SupplierId = suppliers[0].Id,
                CostPrice = 800.00m,
                SellingPrice = 1200.00m,
                OpeningQuantity = 10,
                CurrentQuantity = 10,
                ReorderLevel = 3,
                MaximumStock = 20,
                ShelfLocation = "A-12",
                LeadTime = 5,
                IsActive = true
            },
            new()
            {
                SKU = "CF-CHR-042",
                Name = "Ergonomic Office Chair",
                Description = "Ergonomic chair with lumbar support",
                CategoryId = categories[1].Id,
                BrandId = brands[1].Id,
                UnitId = units[0].Id,
                SupplierId = suppliers[1].Id,
                CostPrice = 120.00m,
                SellingPrice = 200.00m,
                OpeningQuantity = 15,
                CurrentQuantity = 15,
                ReorderLevel = 5,
                MaximumStock = 30,
                ShelfLocation = "B-04",
                LeadTime = 10,
                IsActive = true
            },
            new()
            {
                SKU = "OP-PEN-100",
                Name = "OfficePro Premium Pens Box",
                Description = "Box of 50 black gel pens",
                CategoryId = categories[2].Id,
                BrandId = brands[2].Id,
                UnitId = units[1].Id,
                SupplierId = suppliers[2].Id,
                CostPrice = 5.00m,
                SellingPrice = 12.00m,
                OpeningQuantity = 50,
                CurrentQuantity = 50,
                ReorderLevel = 10,
                MaximumStock = 100,
                ShelfLocation = "C-01",
                LeadTime = 3,
                IsActive = true
            }
        };
        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        // 6. Record Opening Stock transactions
        foreach (var p in products)
        {
            if (p.OpeningQuantity > 0)
            {
                await invService.RecordTransactionAsync(p.Id, "Opening", p.OpeningQuantity, 0, "Initial Setup");
            }
        }

        // 7. Settings
        db.Settings.Add(new Setting { Key = "StoreName", Value = "Alpha Tech Systems" });
        await db.SaveChangesAsync();

        // 8. Sample Purchase Orders
        // PO 1: Received
        var poReceived = new PurchaseOrder
        {
            OrderNumber = $"PO-{DateTime.UtcNow:yyyyMMdd}-0001",
            SupplierId = suppliers[0].Id,
            OrderDate = DateTime.UtcNow.AddDays(-5),
            Status = "Received",
            TotalAmount = 4000.00m,
            Items = new List<PurchaseItem>
            {
                new() { ProductId = products[0].Id, QuantityOrdered = 5, QuantityReceived = 5, UnitPrice = 800.00m }
            }
        };
        db.PurchaseOrders.Add(poReceived);
        await db.SaveChangesAsync();

        // Record stock transaction for received PO
        await invService.RecordTransactionAsync(products[0].Id, "Purchase", 5, 0, $"PO Ref: {poReceived.OrderNumber}");

        // PO 2: Ordered (Pending)
        var poOrdered = new PurchaseOrder
        {
            OrderNumber = $"PO-{DateTime.UtcNow:yyyyMMdd}-0002",
            SupplierId = suppliers[2].Id,
            OrderDate = DateTime.UtcNow,
            Status = "Ordered",
            TotalAmount = 100.00m,
            Items = new List<PurchaseItem>
            {
                new() { ProductId = products[2].Id, QuantityOrdered = 20, QuantityReceived = 0, UnitPrice = 5.00m }
            }
        };
        db.PurchaseOrders.Add(poOrdered);
        await db.SaveChangesAsync();

        // 9. Sample Stock Adjustment
        var adjustment = new StockAdjustment
        {
            ProductId = products[1].Id,
            Quantity = 2,
            AdjustmentType = "Damaged",
            Reason = "Damaged in showroom",
            CreatedDate = DateTime.UtcNow.AddDays(-2)
        };
        db.StockAdjustments.Add(adjustment);
        await db.SaveChangesAsync();

        // Record stock transaction for adjustment
        await invService.RecordTransactionAsync(products[1].Id, "Damaged", 0, 2, "Adj: Damaged in showroom");

        // 10. Sample Stock Count
        var count = new StockCount
        {
            ProductId = products[2].Id,
            PhysicalQuantity = 48,
            SystemQuantity = 50,
            Difference = -2,
            Remarks = "Damaged stock audit",
            CountDate = DateTime.UtcNow.AddDays(-1)
        };
        db.StockCounts.Add(count);
        await db.SaveChangesAsync();

        // Record transaction for count difference
        await invService.RecordTransactionAsync(products[2].Id, "Stock Count", 0, 2, "Physical count difference (Damaged stock audit)");
    }
}
