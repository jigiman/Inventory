using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Services;

public class InventoryService
{
    private readonly AppDbContext _context;

    public InventoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<StockTransaction> RecordTransactionAsync(int productId, string type, decimal qtyIn, decimal qtyOut, string reference)
    {
        var product = await _context.Products.FindAsync(productId);
        if (product == null)
            throw new ArgumentException("Product not found");

        // Calculate running balance based on latest transaction
        var lastTx = await CompiledQueries.GetLatestStockTransactionByProduct(_context, productId);

        decimal currentBalance = lastTx?.RunningBalance ?? 0;
        decimal newBalance = currentBalance + qtyIn - qtyOut;

        var tx = new StockTransaction
        {
            ProductId = productId,
            TransactionType = type,
            Reference = reference,
            QuantityIn = qtyIn,
            QuantityOut = qtyOut,
            RunningBalance = newBalance,
            TransactionDate = DateTime.UtcNow
        };

        _context.StockTransactions.Add(tx);

        // Update product's current cached quantity
        product.CurrentQuantity = newBalance;
        _context.Products.Update(product);

        await _context.SaveChangesAsync();
        return tx;
    }
}
