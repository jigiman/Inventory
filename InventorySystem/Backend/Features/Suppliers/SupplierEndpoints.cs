using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Suppliers;

public static class SupplierEndpoints
{
    public static void MapSupplierEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/suppliers", async (AppDbContext db) => 
            await db.Suppliers.ToListAsync());

        app.MapGet("/api/suppliers/{id:int}", async (AppDbContext db, int id) =>
        {
            var supplier = await db.Suppliers.FindAsync(id);
            return supplier != null ? Results.Ok(supplier) : Results.NotFound();
        });

        app.MapPost("/api/suppliers", async (AppDbContext db, Supplier supplier) =>
        {
            if (string.IsNullOrWhiteSpace(supplier.Name))
                return Results.BadRequest("Name is required");
            db.Suppliers.Add(supplier);
            await db.SaveChangesAsync();
            return Results.Created($"/api/suppliers/{supplier.Id}", supplier);
        });

        app.MapPut("/api/suppliers/{id:int}", async (AppDbContext db, int id, Supplier input) =>
        {
            var supplier = await db.Suppliers.FindAsync(id);
            if (supplier == null) return Results.NotFound();
            supplier.Name = input.Name;
            supplier.ContactPerson = input.ContactPerson;
            supplier.Phone = input.Phone;
            supplier.Email = input.Email;
            supplier.Address = input.Address;
            supplier.Notes = input.Notes;
            await db.SaveChangesAsync();
            return Results.Ok(supplier);
        });

        app.MapDelete("/api/suppliers/{id:int}", async (AppDbContext db, int id) =>
        {
            var supplier = await db.Suppliers.FindAsync(id);
            if (supplier == null) return Results.NotFound();
            db.Suppliers.Remove(supplier);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
