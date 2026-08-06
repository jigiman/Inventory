using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.Sales;

public static class SaleEndpoints
{
    public static void MapSaleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/sales", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            string? status = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            int? customerId = null) =>
        {
            var query = db.Sales
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Product)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Supplier)
                .Include(s => s.Charges)
                .AsNoTracking()
                .AsQueryable();

            if (customerId != null)
            {
                query = query.Where(s => s.CustomerId == customerId.Value);
            }

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

        app.MapGet("/api/sales/{id:int}", async (AppDbContext db, int id) =>
        {
            var sale = await db.Sales
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Product)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Supplier)
                .Include(s => s.Charges)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (sale == null) return Results.NotFound("Sale not found");
            return Results.Ok(sale);
        });

        app.MapGet("/api/sales/{id:int}/pdf", async (AppDbContext db, ExportService es, int id) =>
        {
            var sale = await db.Sales
                .Include(s => s.Customer)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Product)
                .Include(s => s.Items)
                    .ThenInclude(si => si.Supplier)
                .Include(s => s.Charges)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (sale == null) return Results.NotFound("Sale not found");

            var storeNameSetting = await db.Settings.FirstOrDefaultAsync(s => s.Key == "StoreName");
            string storeName = storeNameSetting?.Value ?? "Inventory Store";

            var pdfBytes = es.ExportSaleInvoicePdf(sale, storeName);
            return Results.File(pdfBytes, "application/pdf", $"Invoice_{sale.SaleNumber}.pdf");
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

            decimal itemsSubTotal = 0;
            var resolvedItems = new List<SaleItem>();

            foreach (var item in sale.Items)
            {
                var allocations = await invService.DepleteStockFifoAsync(item.ProductId, item.Quantity, item.SupplierId > 0 ? item.SupplierId : null);
                if (allocations.Count > 0)
                {
                    // Proportionately divide item discounts across allocated batches if depletion returns multiple batches
                    decimal totalAllocatedQty = allocations.Sum(a => a.Quantity);
                    for (int i = 0; i < allocations.Count; i++)
                    {
                        var allocation = allocations[i];
                        decimal ratio = totalAllocatedQty > 0 ? allocation.Quantity / totalAllocatedQty : 1;
                        decimal batchDiscountAmount = Math.Round(item.DiscountAmount * ratio, 2);

                        resolvedItems.Add(new SaleItem
                        {
                            ProductId = item.ProductId,
                            Quantity = allocation.Quantity,
                            UnitPrice = item.UnitPrice,
                            DiscountAmount = batchDiscountAmount,
                            DiscountPercentage = item.DiscountPercentage,
                            SupplierId = allocation.SupplierId,
                            CostPrice = allocation.CostPrice
                        });

                        // Record stock transaction (Outgoing)
                        await invService.RecordTransactionAsync(
                            item.ProductId,
                            "Sale",
                            0,
                            allocation.Quantity,
                            $"Sale Ref: {sale.SaleNumber}",
                            allocation.SupplierId,
                            allocation.CostPrice
                        );
                    }
                }
                else
                {
                    resolvedItems.Add(new SaleItem
                    {
                        ProductId = item.ProductId,
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPrice,
                        DiscountAmount = item.DiscountAmount,
                        DiscountPercentage = item.DiscountPercentage,
                        SupplierId = item.SupplierId > 0 ? item.SupplierId : null
                    });
                }

                decimal itemGross = item.Quantity * item.UnitPrice;
                decimal itemNet = Math.Max(0, itemGross - item.DiscountAmount);
                itemsSubTotal += itemNet;
            }

            sale.SubTotal = itemsSubTotal;
            decimal totalCharges = sale.Charges != null ? sale.Charges.Sum(c => c.Amount) : 0;
            sale.TotalAmount = Math.Max(0, itemsSubTotal - sale.DiscountAmount) + totalCharges;
            sale.Items = resolvedItems;
            db.Sales.Add(sale);

            await db.SaveChangesAsync();
            return Results.Created($"/api/sales/{sale.Id}", sale);
        });

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

            if (sr.TotalAmount <= 0 && sr.Items != null && sr.Items.Count > 0)
            {
                sr.TotalAmount = sr.Items.Sum(i => i.Quantity * i.UnitPrice);
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

        app.MapGet("/api/finance/debtors", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            decimal? minBalance = null) =>
        {
            var sales = await db.Sales
                .Where(s => s.Status != "Cancelled")
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
                .Select(g => new { CustomerId = g.Key!.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
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

        app.MapGet("/api/payments", async (AppDbContext db, int? saleId, int? purchaseOrderId, int? customerId, int? supplierId) =>
        {
            var query = db.Payments.AsQueryable();
            if (saleId != null) query = query.Where(p => p.SaleId == saleId);
            if (purchaseOrderId != null) query = query.Where(p => p.PurchaseOrderId == purchaseOrderId);
            if (customerId != null) query = query.Where(p => p.CustomerId == customerId);
            if (supplierId != null) query = query.Where(p => p.SupplierId == supplierId);
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
    }
}
