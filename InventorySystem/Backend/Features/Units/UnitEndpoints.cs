using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Units;

public static class UnitEndpoints
{
    public static void MapUnitEndpoints(this IEndpointRouteBuilder app)
    {
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
    }
}
