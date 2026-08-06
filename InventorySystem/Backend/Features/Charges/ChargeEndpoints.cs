using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Charges;

public static class ChargeEndpoints
{
    public static void MapChargeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/charges", async (AppDbContext db) =>
            await db.Charges.Where(c => !c.IsArchived).ToListAsync());

        app.MapGet("/api/charges/all", async (AppDbContext db) =>
            await db.Charges.ToListAsync());

        app.MapPost("/api/charges", async (AppDbContext db, Charge charge) =>
        {
            if (string.IsNullOrWhiteSpace(charge.Name))
                return Results.BadRequest("Charge name is required");

            db.Charges.Add(charge);
            await db.SaveChangesAsync();
            return Results.Created($"/api/charges/{charge.Id}", charge);
        });

        app.MapPut("/api/charges/{id:int}", async (AppDbContext db, int id, Charge input) =>
        {
            var charge = await db.Charges.FindAsync(id);
            if (charge == null) return Results.NotFound();

            charge.Name = input.Name;
            charge.DefaultAmount = input.DefaultAmount;
            charge.Description = input.Description;
            charge.IsArchived = input.IsArchived;

            await db.SaveChangesAsync();
            return Results.Ok(charge);
        });

        app.MapDelete("/api/charges/{id:int}", async (AppDbContext db, int id) =>
        {
            var charge = await db.Charges.FindAsync(id);
            if (charge == null) return Results.NotFound();

            db.Charges.Remove(charge);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
