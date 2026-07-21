using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Brands;

public static class BrandEndpoints
{
    public static void MapBrandEndpoints(this IEndpointRouteBuilder app)
    {
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
    }
}
