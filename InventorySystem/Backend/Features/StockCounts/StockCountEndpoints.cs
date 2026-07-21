using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.StockCounts;

public static class StockCountEndpoints
{
    public static void MapStockCountEndpoints(this IEndpointRouteBuilder app)
    {
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
    }
}
