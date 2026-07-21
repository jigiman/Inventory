using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Features.Customers;

public static class CustomerEndpoints
{
    public static void MapCustomerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/customers", async (AppDbContext db) =>
            await db.Customers.ToListAsync());

        app.MapPost("/api/customers", async (AppDbContext db, Customer customer) =>
        {
            if (string.IsNullOrWhiteSpace(customer.Name))
                return Results.BadRequest("Name is required");
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
            return Results.Created($"/api/customers/{customer.Id}", customer);
        });

        app.MapPut("/api/customers/{id:int}", async (AppDbContext db, int id, Customer input) =>
        {
            var customer = await db.Customers.FindAsync(id);
            if (customer == null) return Results.NotFound();
            customer.Name = input.Name;
            customer.ContactPerson = input.ContactPerson;
            customer.Phone = input.Phone;
            customer.Email = input.Email;
            customer.Address = input.Address;
            customer.Notes = input.Notes;
            await db.SaveChangesAsync();
            return Results.Ok(customer);
        });

        app.MapDelete("/api/customers/{id:int}", async (AppDbContext db, int id) =>
        {
            var customer = await db.Customers.FindAsync(id);
            if (customer == null) return Results.NotFound();
            db.Customers.Remove(customer);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
