using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features;

public static class EndpointsSetup
{
    public static void MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        // =========================================================================
        // CATEGORIES
        // =========================================================================
        app.MapGet("/api/categories", async (AppDbContext db) => 
            await db.Categories.ToListAsync());

        app.MapPost("/api/categories", async (AppDbContext db, Category category) =>
        {
            if (string.IsNullOrWhiteSpace(category.Name))
                return Results.BadRequest("Name is required");
            db.Categories.Add(category);
            await db.SaveChangesAsync();
            return Results.Created($"/api/categories/{category.Id}", category);
        });

        app.MapPut("/api/categories/{id:int}", async (AppDbContext db, int id, Category input) =>
        {
            var category = await db.Categories.FindAsync(id);
            if (category == null) return Results.NotFound();
            category.Name = input.Name;
            category.IsArchived = input.IsArchived;
            await db.SaveChangesAsync();
            return Results.Ok(category);
        });

        app.MapDelete("/api/categories/{id:int}", async (AppDbContext db, int id) =>
        {
            var category = await db.Categories.FindAsync(id);
            if (category == null) return Results.NotFound();
            db.Categories.Remove(category);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // CUSTOMERS
        // =========================================================================
        app.MapGet("/api/customers", async (AppDbContext db) =>
            await db.Customers.ToListAsync());

        app.MapPost("/api/customers", async (AppDbContext db, Customer customer) =>
        {
            if (string.IsNullOrWhiteSpace(customer.Name))
                return Results.BadRequest("Name is required");
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
            return Results.Created($"/api/customers/{customer.Id}", customer);
        });

        app.MapPut("/api/customers/{id:int}", async (AppDbContext db, int id, Customer input) =>
        {
            var customer = await db.Customers.FindAsync(id);
            if (customer == null) return Results.NotFound();
            customer.Name = input.Name;
            customer.ContactPerson = input.ContactPerson;
            customer.Phone = input.Phone;
            customer.Email = input.Email;
            customer.Address = input.Address;
            customer.Notes = input.Notes;
            await db.SaveChangesAsync();
            return Results.Ok(customer);
        });

        app.MapDelete("/api/customers/{id:int}", async (AppDbContext db, int id) =>
        {
            var customer = await db.Customers.FindAsync(id);
            if (customer == null) return Results.NotFound();
            db.Customers.Remove(customer);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // BRANDS
        // =========================================================================
        app.MapGet("/api/brands", async (AppDbContext db) => 
            await db.Brands.ToListAsync());

        app.MapPost("/api/brands", async (AppDbContext db, Brand brand) =>
        {
            if (string.IsNullOrWhiteSpace(brand.Name))
                return Results.BadRequest("Name is required");
            db.Brands.Add(brand);
            await db.SaveChangesAsync();
            return Results.Created($"/api/brands/{brand.Id}", brand);
        });

        app.MapPut("/api/brands/{id:int}", async (AppDbContext db, int id, Brand input) =>
        {
            var brand = await db.Brands.FindAsync(id);
            if (brand == null) return Results.NotFound();
            brand.Name = input.Name;
            brand.IsArchived = input.IsArchived;
            await db.SaveChangesAsync();
            return Results.Ok(brand);
        });

        app.MapDelete("/api/brands/{id:int}", async (AppDbContext db, int id) =>
        {
            var brand = await db.Brands.FindAsync(id);
            if (brand == null) return Results.NotFound();
            db.Brands.Remove(brand);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // SALES
        // =========================================================================
        app.MapGet("/api/sales", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            string? status = null,
            DateTime? startDate = null,
            DateTime? endDate = null) =>
        {
            var query = db.Sales
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Product)
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var sLower = search.ToLower();
                query = query.Where(s => s.SaleNumber.ToLower().Contains(sLower) ||
                                         (s.Customer != null && s.Customer.Name.ToLower().Contains(sLower)));
            }

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(s => s.Status == status);
            }

            if (startDate != null)
            {
                query = query.Where(s => s.SaleDate >= startDate.Value);
            }

            if (endDate != null)
            {
                query = query.Where(s => s.SaleDate <= endDate.Value);
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(s => s.SaleDate)
                .ThenByDescending(s => s.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapPost("/api/sales", async (AppDbContext db, InventoryService invService, Sale sale) =>
        {
            if (sale.CustomerId <= 0)
                return Results.BadRequest("Customer is required");
            if (sale.Items == null || sale.Items.Count == 0)
                return Results.BadRequest("Sale must contain at least one item");

            sale.SaleNumber = $"SL-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
            sale.SaleDate = DateTime.UtcNow;
            sale.Status = "Completed";

            db.Sales.Add(sale);

            foreach (var item in sale.Items)
            {
                // Record stock transaction (Outgoing)
                await invService.RecordTransactionAsync(
                    item.ProductId,
                    "Sale",
                    0,
                    item.Quantity,
                    $"Sale Ref: {sale.SaleNumber}"
                );
            }

            await db.SaveChangesAsync();
            return Results.Created($"/api/sales/{sale.Id}", sale);
        });

        // =========================================================================
        // UNITS
        // =========================================================================
        app.MapGet("/api/units", async (AppDbContext db) => 
            await db.Units.ToListAsync());

        app.MapPost("/api/units", async (AppDbContext db, Unit unit) =>
        {
            if (string.IsNullOrWhiteSpace(unit.Name))
                return Results.BadRequest("Name is required");
            db.Units.Add(unit);
            await db.SaveChangesAsync();
            return Results.Created($"/api/units/{unit.Id}", unit);
        });

        app.MapPut("/api/units/{id:int}", async (AppDbContext db, int id, Unit input) =>
        {
            var unit = await db.Units.FindAsync(id);
            if (unit == null) return Results.NotFound();
            unit.Name = input.Name;
            await db.SaveChangesAsync();
            return Results.Ok(unit);
        });

        app.MapDelete("/api/units/{id:int}", async (AppDbContext db, int id) =>
        {
            var unit = await db.Units.FindAsync(id);
            if (unit == null) return Results.NotFound();
            db.Units.Remove(unit);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // SUPPLIERS
        // =========================================================================
        app.MapGet("/api/suppliers", async (AppDbContext db) => 
            await db.Suppliers.ToListAsync());

        app.MapPost("/api/suppliers", async (AppDbContext db, Supplier supplier) =>
        {
            if (string.IsNullOrWhiteSpace(supplier.Name))
                return Results.BadRequest("Name is required");
            db.Suppliers.Add(supplier);
            await db.SaveChangesAsync();
            return Results.Created($"/api/suppliers/{supplier.Id}", supplier);
        });

        app.MapPut("/api/suppliers/{id:int}", async (AppDbContext db, int id, Supplier input) =>
        {
            var supplier = await db.Suppliers.FindAsync(id);
            if (supplier == null) return Results.NotFound();
            supplier.Name = input.Name;
            supplier.ContactPerson = input.ContactPerson;
            supplier.Phone = input.Phone;
            supplier.Email = input.Email;
            supplier.Address = input.Address;
            supplier.Notes = input.Notes;
            await db.SaveChangesAsync();
            return Results.Ok(supplier);
        });

        app.MapDelete("/api/suppliers/{id:int}", async (AppDbContext db, int id) =>
        {
            var supplier = await db.Suppliers.FindAsync(id);
            if (supplier == null) return Results.NotFound();
            db.Suppliers.Remove(supplier);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // PRODUCTS
        // =========================================================================
        app.MapGet("/api/products", async (AppDbContext db, int page = 1, int pageSize = 50, string? search = null) =>
        {
            var query = db.Products
                .Include(p => p.Category)
                .Include(p => p.Brand)
                .Include(p => p.Unit)
                .Include(p => p.Supplier)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(p => p.Name.Contains(search) || p.SKU.Contains(search));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderBy(p => p.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapPost("/api/products", async (AppDbContext db, InventoryService invService, Product product) =>
        {
            if (string.IsNullOrWhiteSpace(product.Name))
                return Results.BadRequest("Name is required");
            if (product.CostPrice < 0 || product.SellingPrice < 0)
                return Results.BadRequest("Prices cannot be negative");

            // SKU unique check (only when provided)
            if (!string.IsNullOrWhiteSpace(product.SKU))
            {
                var skuExists = await db.Products.AnyAsync(p => p.SKU == product.SKU);
                if (skuExists)
                    return Results.BadRequest("SKU must be unique");
            }

            db.Products.Add(product);
            await db.SaveChangesAsync();

            // Record Opening stock as a transaction if quantity > 0
            if (product.OpeningQuantity > 0)
            {
                await invService.RecordTransactionAsync(
                    product.Id, 
                    "Opening", 
                    product.OpeningQuantity, 
                    0, 
                    "Initial Setup"
                );
            }

            return Results.Created($"/api/products/{product.Id}", product);
        });

        app.MapPut("/api/products/{id:int}", async (AppDbContext db, int id, Product input) =>
        {
            var product = await db.Products.FindAsync(id);
            if (product == null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(input.SKU) && product.SKU != input.SKU)
            {
                var skuExists = await db.Products.AnyAsync(p => p.SKU == input.SKU && p.Id != id);
                if (skuExists) return Results.BadRequest("SKU must be unique");
            }

            product.SKU = input.SKU;
            product.Name = input.Name;
            product.Description = input.Description;
            product.CategoryId = input.CategoryId;
            product.BrandId = input.BrandId;
            product.UnitId = input.UnitId;
            product.SupplierId = input.SupplierId;
            product.CostPrice = input.CostPrice;
            product.SellingPrice = input.SellingPrice;
            product.ReorderLevel = input.ReorderLevel;
            product.MaximumStock = input.MaximumStock;
            product.LeadTime = input.LeadTime;
            product.ProductImage = input.ProductImage;
            product.IsActive = input.IsActive;
            product.Notes = input.Notes;

            await db.SaveChangesAsync();
            return Results.Ok(product);
        });

        app.MapDelete("/api/products/{id:int}", async (AppDbContext db, int id) =>
        {
            var product = await db.Products.FindAsync(id);
            if (product == null) return Results.NotFound();
            db.Products.Remove(product);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // =========================================================================
        // PURCHASING
        // =========================================================================
        app.MapGet("/api/purchase-orders", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            string? status = null,
            DateTime? startDate = null,
            DateTime? endDate = null) =>
        {
            var query = db.PurchaseOrders
                .Include(po => po.Supplier)
                .Include(po => po.Items)
                    .ThenInclude(pi => pi.Product)
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var sLower = search.ToLower();
                query = query.Where(po => po.OrderNumber.ToLower().Contains(sLower) ||
                                         (po.Supplier != null && po.Supplier.Name.ToLower().Contains(sLower)));
            }

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(po => po.Status == status);
            }

            if (startDate != null)
            {
                query = query.Where(po => po.OrderDate >= startDate.Value);
            }

            if (endDate != null)
            {
                query = query.Where(po => po.OrderDate <= endDate.Value);
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(po => po.OrderDate)
                .ThenByDescending(po => po.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapPost("/api/purchase-orders", async (AppDbContext db, PurchaseOrder po) =>
        {
            if (po.SupplierId <= 0)
                return Results.BadRequest("Supplier is required");
            if (po.Items == null || po.Items.Count == 0)
                return Results.BadRequest("Purchase Order must contain at least one item");

            po.OrderNumber = $"PO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
            po.OrderDate = DateTime.UtcNow;
            po.Status = "Ordered";

            db.PurchaseOrders.Add(po);
            await db.SaveChangesAsync();
            return Results.Created($"/api/purchase-orders/{po.Id}", po);
        });

        app.MapPost("/api/purchase-orders/{id:int}/receive", async (AppDbContext db, InventoryService invService, int id, List<ReceiveItemDto> receivedItems) =>
        {
            var po = await db.PurchaseOrders.Include(po => po.Items).FirstOrDefaultAsync(po => po.Id == id);
            if (po == null) return Results.NotFound();
            if (po.Status == "Received") return Results.BadRequest("Order has already been fully received");

            foreach (var rItem in receivedItems)
            {
                var poItem = po.Items.FirstOrDefault(i => i.ProductId == rItem.ProductId);
                if (poItem != null)
                {
                    poItem.QuantityReceived = rItem.QuantityReceived;
                    // Add stock transaction
                    if (rItem.QuantityReceived > 0)
                    {
                        await invService.RecordTransactionAsync(
                            rItem.ProductId, 
                            "Purchase", 
                            rItem.QuantityReceived, 
                            0, 
                            $"PO Ref: {po.OrderNumber}"
                        );
                    }
                }
            }

            po.Status = "Received";
            await db.SaveChangesAsync();
            return Results.Ok(po);
        });

        // =========================================================================
        // INVENTORY
        // =========================================================================
        app.MapGet("/api/inventory/ledger", async (AppDbContext db, int page = 1, int pageSize = 50, string? search = null) =>
        {
            var query = db.StockTransactions
                .Include(t => t.Product)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(t => t.TransactionType.Contains(search) ||
                                         t.Reference.Contains(search) ||
                                         (t.Product != null && (t.Product.Name.Contains(search) || t.Product.SKU.Contains(search))));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapPost("/api/inventory/adjust", async (AppDbContext db, InventoryService invService, StockAdjustment adj) =>
        {
            if (adj.ProductId <= 0 || adj.Quantity <= 0)
                return Results.BadRequest("Invalid product or quantity");

            adj.CreatedDate = DateTime.UtcNow;
            db.StockAdjustments.Add(adj);
            await db.SaveChangesAsync();

            string txType = adj.AdjustmentType == "Plus" ? "Adjustment+" :
                             adj.AdjustmentType == "Minus" ? "Adjustment-" :
                             adj.AdjustmentType;

            decimal qtyIn = adj.AdjustmentType == "Plus" ? adj.Quantity : 0;
            decimal qtyOut = (adj.AdjustmentType == "Minus" || adj.AdjustmentType == "Damaged" || adj.AdjustmentType == "Expired") ? adj.Quantity : 0;

            await invService.RecordTransactionAsync(
                adj.ProductId, 
                txType, 
                qtyIn, 
                qtyOut, 
                $"Adj: {adj.Reason}"
            );

            return Results.Ok(adj);
        });

        app.MapPost("/api/inventory/count", async (AppDbContext db, InventoryService invService, StockCount count) =>
        {
            if (count.ProductId <= 0)
                return Results.BadRequest("Invalid product");

            count.CountDate = DateTime.UtcNow;
            count.Difference = count.PhysicalQuantity - count.SystemQuantity;

            db.StockCounts.Add(count);
            await db.SaveChangesAsync();

            if (count.Difference != 0)
            {
                decimal qtyIn = count.Difference > 0 ? count.Difference : 0;
                decimal qtyOut = count.Difference < 0 ? Math.Abs(count.Difference) : 0;

                await invService.RecordTransactionAsync(
                    count.ProductId, 
                    "Stock Count", 
                    qtyIn, 
                    qtyOut, 
                    $"Physical count difference ({count.Remarks})"
                );
            }

            return Results.Ok(count);
        });

        // =========================================================================
        // SETTINGS
        // =========================================================================
        app.MapGet("/api/settings", async (AppDbContext db) => 
            await db.Settings.ToListAsync());

        app.MapPost("/api/settings", async (AppDbContext db, Setting setting) =>
        {
            var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == setting.Key);
            if (existing != null)
            {
                existing.Value = setting.Value;
            }
            else
            {
                db.Settings.Add(setting);
            }
            await db.SaveChangesAsync();
            return Results.Ok(setting);
        });

        // =========================================================================
        // BACKUP & RESTORE
        // =========================================================================
        app.MapGet("/api/backups", (AppDbContext db, BackupService bs) =>
        {
            var dbPath = bs.GetDatabaseFilePath();
            var appDataPath = Path.GetDirectoryName(dbPath) ?? "";
            var backupsDir = Path.Combine(appDataPath, "Backups");
            if (!Directory.Exists(backupsDir))
                return Results.Ok(new List<string>());

            var files = Directory.GetFiles(backupsDir, "*.db")
                .Select(Path.GetFileName)
                .ToList();
            return Results.Ok(files);
        });

        app.MapPost("/api/backups", async (BackupService bs) =>
        {
            var path = await bs.CreateBackupAsync();
            return Results.Ok(new { File = Path.GetFileName(path) });
        });

        app.MapPost("/api/backups/restore", async (BackupService bs, RestoreDto dto) =>
        {
            if (string.IsNullOrWhiteSpace(dto.FileName))
                return Results.BadRequest("FileName is required");

            await bs.RestoreBackupAsync(dto.FileName);
            return Results.Ok(new { Status = "Database restored successfully" });
        });

        // =========================================================================
        // =========================================================================
        // FINANCE & PAYMENTS
        // =========================================================================
        app.MapGet("/api/finance/debtors", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            decimal? minBalance = null) =>
        {
            var sales = await db.Sales
                .GroupBy(s => s.CustomerId)
                .Select(g => new { CustomerId = g.Key, TotalSales = g.Sum(s => s.TotalAmount) })
                .ToListAsync();

            var returns = await db.SalesReturns
                .GroupBy(r => r.CustomerId)
                .Select(g => new { CustomerId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                .ToListAsync();

            var payments = await db.Payments
                .Where(p => p.CustomerId != null)
                .GroupBy(p => p.CustomerId)
                .Select(g => new { CustomerId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                .ToListAsync();

            var customersQuery = db.Customers.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var sLower = search.ToLower();
                customersQuery = customersQuery.Where(c => c.Name.ToLower().Contains(sLower));
            }

            var customers = await customersQuery.ToListAsync();

            var report = customers.Select(c => {
                var totalSales = sales.FirstOrDefault(s => s.CustomerId == c.Id)?.TotalSales ?? 0;
                var totalReturns = returns.FirstOrDefault(r => r.CustomerId == c.Id)?.TotalReturns ?? 0;
                var totalPaid = payments.FirstOrDefault(p => p.CustomerId == c.Id)?.TotalPaid ?? 0;
                return new {
                    Customer = c,
                    TotalSales = totalSales,
                    TotalReturns = totalReturns,
                    TotalPaid = totalPaid,
                    Balance = totalSales - totalReturns - totalPaid
                };
            }).Where(r => {
                var matchesBalance = minBalance == null || Math.Abs(r.Balance) >= minBalance.Value;
                return r.Balance != 0 && matchesBalance;
            }).ToList();

            var totalCount = report.Count;
            var items = report
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapGet("/api/finance/creditors", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            decimal? minBalance = null) =>
        {
            var purchases = await db.PurchaseOrders
                .GroupBy(po => po.SupplierId)
                .Select(g => new { SupplierId = g.Key, TotalPurchases = g.Sum(po => po.TotalAmount) })
                .ToListAsync();

            var returns = await db.PurchaseReturns
                .GroupBy(r => r.SupplierId)
                .Select(g => new { SupplierId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                .ToListAsync();

            var payments = await db.Payments
                .Where(p => p.SupplierId != null)
                .GroupBy(p => p.SupplierId)
                .Select(g => new { SupplierId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                .ToListAsync();

            var suppliersQuery = db.Suppliers.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var sLower = search.ToLower();
                suppliersQuery = suppliersQuery.Where(s => s.Name.ToLower().Contains(sLower));
            }

            var suppliers = await suppliersQuery.ToListAsync();

            var report = suppliers.Select(s => {
                var totalPurchases = purchases.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPurchases ?? 0;
                var totalReturns = returns.FirstOrDefault(r => r.SupplierId == s.Id)?.TotalReturns ?? 0;
                var totalPaid = payments.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPaid ?? 0;
                return new {
                    Supplier = s,
                    TotalPurchases = totalPurchases,
                    TotalReturns = totalReturns,
                    TotalPaid = totalPaid,
                    Balance = totalPurchases - totalReturns - totalPaid
                };
            }).Where(r => {
                var matchesBalance = minBalance == null || Math.Abs(r.Balance) >= minBalance.Value;
                return r.Balance != 0 && matchesBalance;
            }).ToList();

            var totalCount = report.Count;
            var items = report
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return Results.Ok(new { totalCount, items, page, pageSize });
        });

        app.MapGet("/api/payments", async (AppDbContext db, int? saleId, int? purchaseOrderId) =>
        {
            var query = db.Payments.AsQueryable();
            if (saleId != null) query = query.Where(p => p.SaleId == saleId);
            if (purchaseOrderId != null) query = query.Where(p => p.PurchaseOrderId == purchaseOrderId);
            return await query.ToListAsync();
        });

        app.MapPost("/api/payments", async (AppDbContext db, Payment payment) =>
        {
            if (payment.Amount <= 0)
                return Results.BadRequest("Amount must be greater than zero");
            if (payment.CustomerId == null && payment.SupplierId == null)
                return Results.BadRequest("Customer or Supplier is required");

            payment.PaymentDate = DateTime.UtcNow;
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            return Results.Created($"/api/payments/{payment.Id}", payment);
        });

        // =========================================================================
        // RETURNS
        // =========================================================================
        app.MapGet("/api/sales-returns", async (AppDbContext db, int? customerId, int? saleId) =>
        {
            var query = db.SalesReturns
                .Include(sr => sr.Customer)
                .Include(sr => sr.Sale)
                .Include(sr => sr.Items)
                    .ThenInclude(sri => sri.Product)
                .AsQueryable();

            if (customerId != null) query = query.Where(sr => sr.CustomerId == customerId);
            if (saleId != null) query = query.Where(sr => sr.SaleId == saleId);

            return await query.ToListAsync();
        });

        app.MapPost("/api/sales-returns", async (AppDbContext db, InventoryService invService, SalesReturn sr) =>
        {
            if (sr.CustomerId <= 0)
                return Results.BadRequest("Customer is required");
            if (sr.Items == null || sr.Items.Count == 0)
                return Results.BadRequest("Return must contain at least one item");

            sr.ReturnNumber = $"SR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
            sr.ReturnDate = DateTime.UtcNow;

            if (sr.SaleId != null && sr.SaleId > 0)
            {
                var sale = await db.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == sr.SaleId);
                if (sale == null)
                    return Results.BadRequest("Associated sale not found");

                var prevReturns = await db.SalesReturnItems
                    .Where(ri => ri.SalesReturn!.SaleId == sr.SaleId)
                    .GroupBy(ri => ri.ProductId)
                    .Select(g => new { ProductId = g.Key, Qty = g.Sum(ri => ri.Quantity) })
                    .ToDictionaryAsync(x => x.ProductId, x => x.Qty);

                foreach (var item in sr.Items)
                {
                    var saleItem = sale.Items.FirstOrDefault(si => si.ProductId == item.ProductId);
                    if (saleItem == null)
                        return Results.BadRequest($"Product with ID {item.ProductId} was not part of the original sale");

                    var prevQty = prevReturns.GetValueOrDefault(item.ProductId, 0);
                    if (prevQty + item.Quantity > saleItem.Quantity)
                        return Results.BadRequest($"Cannot return more than originally purchased. Purchased: {saleItem.Quantity}, Previously Returned: {prevQty}, Attempted: {item.Quantity}");
                }
            }

            db.SalesReturns.Add(sr);

            foreach (var item in sr.Items)
            {
                await invService.RecordTransactionAsync(
                    item.ProductId,
                    "Sales Return",
                    item.Quantity,
                    0,
                    $"SR Ref: {sr.ReturnNumber}"
                );
            }

            await db.SaveChangesAsync();
            return Results.Created($"/api/sales-returns/{sr.Id}", sr);
        });

        app.MapGet("/api/purchase-returns", async (AppDbContext db, int? supplierId, int? purchaseOrderId) =>
        {
            var query = db.PurchaseReturns
                .Include(pr => pr.Supplier)
                .Include(pr => pr.PurchaseOrder)
                .Include(pr => pr.Items)
                    .ThenInclude(pri => pri.Product)
                .AsQueryable();

            if (supplierId != null) query = query.Where(pr => pr.SupplierId == supplierId);
            if (purchaseOrderId != null) query = query.Where(pr => pr.PurchaseOrderId == purchaseOrderId);

            return await query.ToListAsync();
        });

        app.MapPost("/api/purchase-returns", async (AppDbContext db, InventoryService invService, PurchaseReturn pr) =>
        {
            if (pr.SupplierId <= 0)
                return Results.BadRequest("Supplier is required");
            if (pr.Items == null || pr.Items.Count == 0)
                return Results.BadRequest("Return must contain at least one item");

            pr.ReturnNumber = $"PR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
            pr.ReturnDate = DateTime.UtcNow;

            if (pr.PurchaseOrderId != null && pr.PurchaseOrderId > 0)
            {
                var po = await db.PurchaseOrders.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == pr.PurchaseOrderId);
                if (po == null)
                    return Results.BadRequest("Associated purchase order not found");

                var prevReturns = await db.PurchaseReturnItems
                    .Where(ri => ri.PurchaseReturn!.PurchaseOrderId == pr.PurchaseOrderId)
                    .GroupBy(ri => ri.ProductId)
                    .Select(g => new { ProductId = g.Key, Qty = g.Sum(ri => ri.Quantity) })
                    .ToDictionaryAsync(x => x.ProductId, x => x.Qty);

                foreach (var item in pr.Items)
                {
                    var poItem = po.Items.FirstOrDefault(pi => pi.ProductId == item.ProductId);
                    if (poItem == null)
                        return Results.BadRequest($"Product with ID {item.ProductId} was not part of the original purchase order");

                    var prevQty = prevReturns.GetValueOrDefault(item.ProductId, 0);
                    if (prevQty + item.Quantity > poItem.QuantityReceived)
                        return Results.BadRequest($"Cannot return more than originally received. Received: {poItem.QuantityReceived}, Previously Returned: {prevQty}, Attempted: {item.Quantity}");
                }
            }

            db.PurchaseReturns.Add(pr);

            foreach (var item in pr.Items)
            {
                await invService.RecordTransactionAsync(
                    item.ProductId,
                    "Purchase Return",
                    0,
                    item.Quantity,
                    $"PR Ref: {pr.ReturnNumber}"
                );
            }

            await db.SaveChangesAsync();
            return Results.Created($"/api/purchase-returns/{pr.Id}", pr);
        });

        // =========================================================================
        // REPORTS & DASHBOARD
        // =========================================================================
        app.MapGet("/api/reports/dashboard", async (AppDbContext db) =>
        {
            var totalProducts = await db.Products.CountAsync();
            var totalQuantity = await db.Products.SumAsync(p => p.CurrentQuantity);
            var totalValue = await db.Products.SumAsync(p => p.CurrentQuantity * p.CostPrice);
            var lowStockCount = await db.Products.CountAsync(p => p.IsActive && p.CurrentQuantity <= p.ReorderLevel && p.CurrentQuantity > 0);
            var outOfStockCount = await db.Products.CountAsync(p => p.IsActive && p.CurrentQuantity <= 0);

            // Debtor/Creditor KPIs - Sum of all positive outstanding balances
            var debtorBalances = await db.Customers
                .Select(c => new {
                    SalesTotal = db.Sales.Where(s => s.CustomerId == c.Id).Sum(s => s.TotalAmount),
                    ReturnsTotal = db.SalesReturns.Where(r => r.CustomerId == c.Id).Sum(r => r.TotalAmount),
                    PaymentsTotal = db.Payments.Where(p => p.CustomerId == c.Id).Sum(p => p.IsRefund ? -p.Amount : p.Amount)
                })
                .ToListAsync();
            var totalDebtors = debtorBalances.Sum(x => Math.Max(0, x.SalesTotal - x.ReturnsTotal - x.PaymentsTotal));

            var creditorBalances = await db.Suppliers
                .Select(s => new {
                    PurchasesTotal = db.PurchaseOrders.Where(po => po.SupplierId == s.Id).Sum(po => po.TotalAmount),
                    ReturnsTotal = db.PurchaseReturns.Where(r => r.SupplierId == s.Id).Sum(r => r.TotalAmount),
                    PaymentsTotal = db.Payments.Where(p => p.SupplierId == s.Id).Sum(p => p.IsRefund ? -p.Amount : p.Amount)
                })
                .ToListAsync();
            var totalCreditors = creditorBalances.Sum(x => Math.Max(0, x.PurchasesTotal - x.ReturnsTotal - x.PaymentsTotal));

            var recentTransactions = await db.StockTransactions
                .Include(t => t.Product)
                .OrderByDescending(t => t.TransactionDate)
                .Take(5)
                .Select(t => new
                {
                    t.Id,
                    t.TransactionDate,
                    ProductName = t.Product != null ? t.Product.Name : "",
                    t.TransactionType,
                    Quantity = t.QuantityIn > 0 ? t.QuantityIn : -t.QuantityOut
                })
                .ToListAsync();

            return Results.Ok(new
            {
                TotalProducts = totalProducts,
                TotalQuantity = totalQuantity,
                TotalValue = totalValue,
                LowStockCount = lowStockCount,
                OutOfStockCount = outOfStockCount,
                TotalDebtors = totalDebtors,
                TotalCreditors = totalCreditors,
                RecentTransactions = recentTransactions
            });
        });

        app.MapGet("/api/reports/export", async (AppDbContext db, ExportService es, string type, string format) =>
        {
            List<string> headers = new();
            List<List<string>> rows = new();
            string title = "Report";

            if (type == "CurrentStock")
            {
                title = "Current Stock Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Cost Price", "Valuation" };
                var list = await db.Products.Include(p => p.Category).AsNoTracking().ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    p.CostPrice.ToString("F2"),
                    (p.CurrentQuantity * p.CostPrice).ToString("F2")
                }).ToList();
            }
            else if (type == "InventoryLedger")
            {
                title = "Inventory Ledger Report";
                headers = new List<string> { "Date", "Product SKU", "Product Name", "Type", "Ref", "Qty In", "Qty Out", "Running Bal" };
                var list = await db.StockTransactions.Include(t => t.Product).AsNoTracking().OrderBy(t => t.TransactionDate).ToListAsync();
                rows = list.Select(t => new List<string>
                {
                    t.TransactionDate.ToString("yyyy-MM-dd HH:mm"),
                    t.Product?.SKU ?? "",
                    t.Product?.Name ?? "",
                    t.TransactionType,
                    t.Reference,
                    t.QuantityIn.ToString("0.##"),
                    t.QuantityOut.ToString("0.##"),
                    t.RunningBalance.ToString("0.##")
                }).ToList();
            }
            else if (type == "InventoryValuation")
            {
                title = "Inventory Valuation Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Cost Price", "Selling Price", "Cost Valuation", "Selling Valuation" };
                var list = await db.Products.Include(p => p.Category).AsNoTracking().ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    p.CostPrice.ToString("F2"),
                    p.SellingPrice.ToString("F2"),
                    (p.CurrentQuantity * p.CostPrice).ToString("F2"),
                    (p.CurrentQuantity * p.SellingPrice).ToString("F2")
                }).ToList();
            }
            else if (type == "LowStock")
            {
                title = "Low Stock Alert Report";
                headers = new List<string> { "SKU", "Product Name", "Current Stock", "Reorder Level" };
                var list = await db.Products.AsNoTracking().Where(p => p.CurrentQuantity <= p.ReorderLevel).ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.CurrentQuantity.ToString("0.##"),
                    p.ReorderLevel.ToString("0.##")
                }).ToList();
            }
            else if (type == "OutOfStock")
            {
                title = "Out of Stock Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Brand", "Cost Price", "Reorder Level" };
                var list = await db.Products.Include(p => p.Category).Include(p => p.Brand).AsNoTracking().Where(p => p.CurrentQuantity <= 0).ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.Brand?.Name ?? "",
                    p.CostPrice.ToString("F2"),
                    p.ReorderLevel.ToString("0.##")
                }).ToList();
            }
            else if (type == "DeadStock")
            {
                title = "Dead Stock Report (No Activity 90d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Last Tx Date" };
                var cutoff = DateTime.UtcNow.AddDays(-90);
                var activeIds = await db.StockTransactions.AsNoTracking().Where(t => t.TransactionDate >= cutoff).Select(t => t.ProductId).Distinct().ToListAsync();
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => !activeIds.Contains(p.Id)).ToListAsync();
                var lastTxs = await db.StockTransactions.AsNoTracking().GroupBy(t => t.ProductId).Select(g => new { ProductId = g.Key, LastDate = g.Max(t => t.TransactionDate) }).ToListAsync();
                var lastTxMap = lastTxs.ToDictionary(x => x.ProductId, x => x.LastDate);
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    lastTxMap.TryGetValue(p.Id, out var dt) ? dt.ToString("yyyy-MM-dd") : "Never"
                }).ToList();
            }
            else if (type == "FastMoving")
            {
                title = "Fast Moving Items (Top Outgoing 30d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Outgoing Qty" };
                var cutoff = DateTime.UtcNow.AddDays(-30);
                var outTxs = await db.StockTransactions
                    .AsNoTracking()
                    .Where(t => t.TransactionDate >= cutoff && t.QuantityOut > 0)
                    .GroupBy(t => t.ProductId)
                    .Select(g => new { ProductId = g.Key, OutQty = g.Sum(t => t.QuantityOut) })
                    .OrderByDescending(x => x.OutQty)
                    .Take(10)
                    .ToListAsync();
                var outQtyMap = outTxs.ToDictionary(x => x.ProductId, x => x.OutQty);
                var activeIds = outTxs.Select(x => x.ProductId).ToList();
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => activeIds.Contains(p.Id)).ToListAsync();
                rows = list
                    .Select(p => new { Product = p, Qty = outQtyMap.GetValueOrDefault(p.Id, 0) })
                    .OrderByDescending(x => x.Qty)
                    .Select(x => new List<string>
                    {
                        x.Product.SKU,
                        x.Product.Name,
                        x.Product.Category?.Name ?? "",
                        x.Product.CurrentQuantity.ToString("0.##"),
                        x.Qty.ToString("0.##")
                    }).ToList();
            }
            else if (type == "SlowMoving")
            {
                title = "Slow Moving Items (Low Outgoing 30d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Outgoing Qty" };
                var cutoff = DateTime.UtcNow.AddDays(-30);
                var outTxs = await db.StockTransactions
                    .AsNoTracking()
                    .Where(t => t.TransactionDate >= cutoff && t.QuantityOut > 0)
                    .GroupBy(t => t.ProductId)
                    .Select(g => new { ProductId = g.Key, OutQty = g.Sum(t => t.QuantityOut) })
                    .ToListAsync();
                var outQtyMap = outTxs.ToDictionary(x => x.ProductId, x => x.OutQty);
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => p.IsActive).ToListAsync();
                rows = list
                    .Select(p => new { Product = p, Qty = outQtyMap.GetValueOrDefault(p.Id, 0) })
                    .Where(x => x.Qty < 5)
                    .OrderBy(x => x.Qty)
                    .Select(x => new List<string>
                    {
                        x.Product.SKU,
                        x.Product.Name,
                        x.Product.Category?.Name ?? "",
                        x.Product.CurrentQuantity.ToString("0.##"),
                        x.Qty.ToString("0.##")
                    }).ToList();
            }
            else if (type == "SupplierReport")
            {
                title = "Supplier Performance Report";
                headers = new List<string> { "Supplier Name", "Contact", "Phone", "Email", "Total Products", "Purchase Orders" };
                var prodCounts = await db.Products.AsNoTracking().GroupBy(p => p.SupplierId).Select(g => new { SupplierId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.SupplierId, x => x.Count);
                var poCounts = await db.PurchaseOrders.AsNoTracking().GroupBy(po => po.SupplierId).Select(g => new { SupplierId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.SupplierId, x => x.Count);
                var list = await db.Suppliers.AsNoTracking().ToListAsync();
                rows = list.Select(s => new List<string>
                {
                    s.Name,
                    s.ContactPerson,
                    s.Phone,
                    s.Email,
                    prodCounts.GetValueOrDefault(s.Id, 0).ToString(),
                    poCounts.GetValueOrDefault(s.Id, 0).ToString()
                }).ToList();
            }
            else if (type == "PurchaseReport")
            {
                title = "Purchase Orders Summary Report";
                headers = new List<string> { "PO Number", "Supplier", "Date", "Status", "Items Count", "Total Cost" };
                var list = await db.PurchaseOrders.Include(po => po.Supplier).Include(po => po.Items).AsNoTracking().ToListAsync();
                rows = list.Select(po => new List<string>
                {
                    po.OrderNumber ?? "",
                    po.Supplier?.Name ?? "",
                    po.OrderDate.ToString("yyyy-MM-dd"),
                    po.Status ?? "",
                    po.Items?.Count.ToString() ?? "0",
                    po.Items?.Sum(i => i.QuantityOrdered * i.UnitPrice).ToString("F2") ?? "0.00"
                }).ToList();
            }
            else if (type == "SalesReport")
            {
                title = "Sales Summary Report";
                headers = new List<string> { "Sale Number", "Customer Name", "Date", "Items Count", "Status", "Total Amount" };
                var list = await db.Sales.Include(s => s.Customer).Include(s => s.Items).AsNoTracking().ToListAsync();
                rows = list.Select(s => new List<string>
                {
                    s.SaleNumber,
                    s.Customer?.Name ?? "",
                    s.SaleDate.ToString("yyyy-MM-dd HH:mm"),
                    s.Items?.Count.ToString() ?? "0",
                    s.Status,
                    s.TotalAmount.ToString("F2")
                }).ToList();
            }
            else if (type == "DebtorsReport")
            {
                title = "Debtors Balance Report";
                headers = new List<string> { "Customer Name", "Total Sales", "Total Returns", "Total Paid", "Outstanding Balance" };
                var sales = await db.Sales
                    .GroupBy(s => s.CustomerId)
                    .Select(g => new { CustomerId = g.Key, TotalSales = g.Sum(s => s.TotalAmount) })
                    .ToListAsync();
                var returns = await db.SalesReturns
                    .GroupBy(r => r.CustomerId)
                    .Select(g => new { CustomerId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                    .ToListAsync();
                var payments = await db.Payments
                    .Where(p => p.CustomerId != null)
                    .GroupBy(p => p.CustomerId)
                    .Select(g => new { CustomerId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                    .ToListAsync();
                var customers = await db.Customers.ToListAsync();
                var list = customers.Select(c => {
                    var totalSales = sales.FirstOrDefault(s => s.CustomerId == c.Id)?.TotalSales ?? 0;
                    var totalReturns = returns.FirstOrDefault(r => r.CustomerId == c.Id)?.TotalReturns ?? 0;
                    var totalPaid = payments.FirstOrDefault(p => p.CustomerId == c.Id)?.TotalPaid ?? 0;
                    return new {
                        Name = c.Name,
                        TotalSales = totalSales,
                        TotalReturns = totalReturns,
                        TotalPaid = totalPaid,
                        Balance = totalSales - totalReturns - totalPaid
                    };
                }).Where(r => r.Balance != 0).ToList();
                rows = list.Select(r => new List<string>
                {
                    r.Name,
                    r.TotalSales.ToString("F2"),
                    r.TotalReturns.ToString("F2"),
                    r.TotalPaid.ToString("F2"),
                    r.Balance.ToString("F2")
                }).ToList();
            }
            else if (type == "CreditorsReport")
            {
                title = "Creditors Balance Report";
                headers = new List<string> { "Supplier Name", "Total Purchases", "Total Returns", "Total Paid", "Outstanding Balance" };
                var purchases = await db.PurchaseOrders
                    .GroupBy(po => po.SupplierId)
                    .Select(g => new { SupplierId = g.Key, TotalPurchases = g.Sum(po => po.TotalAmount) })
                    .ToListAsync();
                var returns = await db.PurchaseReturns
                    .GroupBy(r => r.SupplierId)
                    .Select(g => new { SupplierId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                    .ToListAsync();
                var payments = await db.Payments
                    .Where(p => p.SupplierId != null)
                    .GroupBy(p => p.SupplierId)
                    .Select(g => new { SupplierId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                    .ToListAsync();
                var suppliers = await db.Suppliers.ToListAsync();
                var list = suppliers.Select(s => {
                    var totalPurchases = purchases.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPurchases ?? 0;
                    var totalReturns = returns.FirstOrDefault(r => r.SupplierId == s.Id)?.TotalReturns ?? 0;
                    var totalPaid = payments.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPaid ?? 0;
                    return new {
                        Name = s.Name,
                        TotalPurchases = totalPurchases,
                        TotalReturns = totalReturns,
                        TotalPaid = totalPaid,
                        Balance = totalPurchases - totalReturns - totalPaid
                    };
                }).Where(r => r.Balance != 0).ToList();
                rows = list.Select(r => new List<string>
                {
                    r.Name,
                    r.TotalPurchases.ToString("F2"),
                    r.TotalReturns.ToString("F2"),
                    r.TotalPaid.ToString("F2"),
                    r.Balance.ToString("F2")
                }).ToList();
            }
            else
            {
                return Results.BadRequest("Unsupported report type");
            }

            byte[] fileBytes;
            string contentType;
            string fileName;

            if (format.Equals("excel", StringComparison.OrdinalIgnoreCase))
            {
                fileBytes = es.ExportToExcel(type, headers, rows);
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            }
            else if (format.Equals("pdf", StringComparison.OrdinalIgnoreCase))
            {
                fileBytes = es.ExportToPdf(title, headers, rows);
                contentType = "application/pdf";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.pdf";
            }
            else if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
            {
                fileBytes = es.ExportToCsv(headers, rows);
                contentType = "text/csv";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.csv";
            }
            else
            {
                return Results.BadRequest("Unsupported format");
            }

            return Results.File(fileBytes, contentType, fileName);
        });
    }
}

public class ReceiveItemDto
{
    public int ProductId { get; set; }
    public decimal QuantityReceived { get; set; }
}

public class RestoreDto
{
    public string FileName { get; set; } = string.Empty;
}
