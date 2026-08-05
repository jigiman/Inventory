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

namespace Backend.Features.Purchases;

public static class PurchaseEndpoints
{
    public static void MapPurchaseEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/purchase-orders", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            string? status = null,
            int? supplierId = null,
            DateTime? startDate = null,
            DateTime? endDate = null) =>
        {
            var query = db.PurchaseOrders
                .Include(po => po.Supplier)
                .Include(po => po.Items)
                    .ThenInclude(pi => pi.Product)
                .AsNoTracking()
                .AsQueryable();

            if (supplierId != null)
            {
                query = query.Where(po => po.SupplierId == supplierId.Value);
            }

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

        app.MapGet("/api/purchase-orders/{id:int}", async (AppDbContext db, int id) =>
        {
            var po = await db.PurchaseOrders
                .Include(p => p.Supplier)
                .Include(p => p.Items)
                    .ThenInclude(pi => pi.Product)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);

            return po != null ? Results.Ok(po) : Results.NotFound();
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
                            $"PO Ref: {po.OrderNumber}",
                            po.SupplierId,
                            poItem.UnitPrice
                        );
                    }
                }
            }

            po.Status = "Received";
            await db.SaveChangesAsync();
            return Results.Ok(po);
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

            if (pr.TotalAmount <= 0 && pr.Items != null && pr.Items.Count > 0)
            {
                pr.TotalAmount = pr.Items.Sum(i => i.Quantity * i.CostPrice);
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

        app.MapGet("/api/finance/creditors", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 50,
            string? search = null,
            decimal? minBalance = null) =>
        {
            var purchases = await db.PurchaseOrders
                .Where(po => po.Status != "Cancelled" && po.Status != "Draft")
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
                .Select(g => new { SupplierId = g.Key!.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
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
    }
}

public class ReceiveItemDto
{
    public int ProductId { get; set; }
    public decimal QuantityReceived { get; set; }
}
