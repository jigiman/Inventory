using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public static class CompiledQueries
{
    public static readonly Func<AppDbContext, int, Task<StockTransaction?>> GetLatestStockTransactionByProduct =
        EF.CompileAsyncQuery((AppDbContext context, int productId) =>
            context.StockTransactions
                .Where(t => t.ProductId == productId)
                .OrderByDescending(t => t.TransactionDate)
                .ThenByDescending(t => t.Id)
                .FirstOrDefault()
        );

    public static readonly Func<AppDbContext, int, Task<Product?>> GetProductWithCategoryAndBrand =
        EF.CompileAsyncQuery((AppDbContext context, int productId) =>
            context.Products
                .Include(p => p.Category)
                .Include(p => p.Brand)
                .FirstOrDefault(p => p.Id == productId)
        );
}
