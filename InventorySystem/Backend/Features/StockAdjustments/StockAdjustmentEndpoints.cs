using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.StockAdjustments;

public static class StockAdjustmentEndpoints
{
    public static void MapStockAdjustmentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/inventory/ledger", async (AppDbContext db, int page = 1, int pageSize = 50, string? search = null) =>
        {
            var query = db.StockTransactions
                .Include(t => t.Product)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lowerSearch = search.ToLower();
                query = query.Where(t => t.TransactionType.ToLower().Contains(lowerSearch) ||
                                         t.Reference.ToLower().Contains(lowerSearch) ||
                                         (t.Product != null && (t.Product.Name.ToLower().Contains(lowerSearch) || t.Product.SKU.ToLower().Contains(lowerSearch))));
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
    }
}
