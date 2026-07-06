using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.Products;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this IEndpointRouteBuilder app)
    {
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
    }
}
