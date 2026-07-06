using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Categories;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
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
    }
}
