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
                .Include(p => p.Variants)
                .Where(p => p.ParentProductId == null)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lowerSearch = search.ToLower();
                query = query.Where(p => 
                    p.Name.ToLower().Contains(lowerSearch) || 
                    p.SKU.ToLower().Contains(lowerSearch) || 
                    p.Variants.Any(v => v.SKU.ToLower().Contains(lowerSearch) || v.VariantValues.ToLower().Contains(lowerSearch)));
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

            var variantsToCreate = product.Variants?.ToList() ?? new List<Product>();
            product.Variants = new List<Product>();

            db.Products.Add(product);
            await db.SaveChangesAsync();

            // Record Opening stock as a transaction if quantity > 0
            if (product.OpeningQuantity > 0 && variantsToCreate.Count == 0)
            {
                await invService.RecordTransactionAsync(
                    product.Id, 
                    "Opening", 
                    product.OpeningQuantity, 
                    0, 
                    "Initial Setup"
                );
            }

            foreach (var variant in variantsToCreate)
            {
                variant.ParentProductId = product.Id;
                variant.CategoryId = product.CategoryId;
                variant.BrandId = product.BrandId;
                variant.UnitId = product.UnitId;
                variant.SupplierId = product.SupplierId;
                variant.Name = $"{product.Name} ({variant.VariantValues})";
                variant.CurrentQuantity = variant.OpeningQuantity;

                db.Products.Add(variant);
            }

            if (variantsToCreate.Count > 0)
            {
                await db.SaveChangesAsync();
                foreach (var variant in variantsToCreate)
                {
                    if (variant.OpeningQuantity > 0)
                    {
                        await invService.RecordTransactionAsync(
                            variant.Id,
                            "Opening",
                            variant.OpeningQuantity,
                            0,
                            $"Initial Setup ({variant.VariantValues})"
                        );
                    }
                }
            }

            return Results.Created($"/api/products/{product.Id}", product);
        });

        app.MapPut("/api/products/{id:int}", async (AppDbContext db, InventoryService invService, int id, Product input) =>
        {
            var product = await db.Products
                .Include(p => p.Variants)
                .FirstOrDefaultAsync(p => p.Id == id);
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

            if (input.Variants != null)
            {
                var incomingIds = input.Variants.Select(v => v.Id).Where(vId => vId > 0).ToList();
                var variantsToDelete = product.Variants.Where(v => !incomingIds.Contains(v.Id)).ToList();
                foreach (var toDelete in variantsToDelete)
                {
                    db.Products.Remove(toDelete);
                }

                foreach (var vInput in input.Variants)
                {
                    if (vInput.Id > 0)
                    {
                        var existingVariant = product.Variants.FirstOrDefault(v => v.Id == vInput.Id);
                        if (existingVariant != null)
                        {
                            existingVariant.SKU = vInput.SKU;
                            existingVariant.VariantValues = vInput.VariantValues;
                            existingVariant.Name = $"{product.Name} ({vInput.VariantValues})";
                            existingVariant.CostPrice = vInput.CostPrice;
                            existingVariant.SellingPrice = vInput.SellingPrice;
                            existingVariant.ReorderLevel = vInput.ReorderLevel;
                            existingVariant.MaximumStock = vInput.MaximumStock;
                            existingVariant.IsActive = vInput.IsActive;
                            existingVariant.CategoryId = product.CategoryId;
                            existingVariant.BrandId = product.BrandId;
                            existingVariant.UnitId = product.UnitId;
                            existingVariant.SupplierId = product.SupplierId;
                        }
                    }
                    else
                    {
                        var newVariant = new Product
                        {
                            ParentProductId = product.Id,
                            SKU = vInput.SKU,
                            VariantValues = vInput.VariantValues,
                            Name = $"{product.Name} ({vInput.VariantValues})",
                            CostPrice = vInput.CostPrice,
                            SellingPrice = vInput.SellingPrice,
                            OpeningQuantity = vInput.OpeningQuantity,
                            CurrentQuantity = vInput.OpeningQuantity,
                            ReorderLevel = vInput.ReorderLevel,
                            MaximumStock = vInput.MaximumStock,
                            IsActive = vInput.IsActive,
                            CategoryId = product.CategoryId,
                            BrandId = product.BrandId,
                            UnitId = product.UnitId,
                            SupplierId = product.SupplierId,
                        };
                        db.Products.Add(newVariant);
                    }
                }
            }

            await db.SaveChangesAsync();

            if (input.Variants != null)
            {
                var dbVariants = await db.Products.Where(v => v.ParentProductId == product.Id).ToListAsync();
                foreach (var dbV in dbVariants)
                {
                    var txExists = await db.StockTransactions.AnyAsync(t => t.ProductId == dbV.Id && t.TransactionType == "Opening");
                    if (!txExists && dbV.OpeningQuantity > 0)
                    {
                        await invService.RecordTransactionAsync(
                            dbV.Id,
                            "Opening",
                            dbV.OpeningQuantity,
                            0,
                            $"Initial Setup ({dbV.VariantValues})"
                        );
                    }
                }
            }

            return Results.Ok(product);
        });

        app.MapDelete("/api/products/{id:int}", async (AppDbContext db, int id) =>
        {
            // Note: EF cascade delete will automatically handle variant deletion due to the configured OnDelete(DeleteBehavior.Cascade)
            // But let's fetch and delete parent
            var product = await db.Products.FindAsync(id);
            if (product == null) return Results.NotFound();
            db.Products.Remove(product);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        app.MapGet("/api/products/{id:int}/batches", async (AppDbContext db, int id) =>
        {
            var batches = await db.StockTransactions
                .Where(t => t.ProductId == id && t.QuantityIn > 0 && t.RemainingQuantity > 0)
                .Include(t => t.Supplier)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.Id)
                .Select(t => new {
                    t.Id,
                    t.SupplierId,
                    SupplierName = t.Supplier != null ? t.Supplier.Name : "Opening Stock / Unknown",
                    t.RemainingQuantity,
                    t.CostPrice,
                    t.TransactionDate
                })
                .ToListAsync();
            return Results.Ok(batches);
        });
    }
}
