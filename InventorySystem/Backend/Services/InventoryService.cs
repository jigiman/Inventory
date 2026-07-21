using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Services;

public class FifoAllocation
{
    public int? SupplierId { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal Quantity { get; set; }
}

public class InventoryService
{
    private readonly AppDbContext _context;

    public InventoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<FifoAllocation>> DepleteStockFifoAsync(int productId, decimal quantity, int? supplierId = null)
    {
        var product = await _context.Products.FindAsync(productId);
        if (product == null)
            throw new ArgumentException("Product not found");

        var allocations = new List<FifoAllocation>();
        decimal remainingToDeplete = quantity;

        // Find incoming transactions with RemainingQuantity > 0, ordered chronologically
        var query = _context.StockTransactions
            .Where(t => t.ProductId == productId && t.QuantityIn > 0 && t.RemainingQuantity > 0);

        if (supplierId.HasValue && supplierId.Value > 0)
        {
            query = query.Where(t => t.SupplierId == supplierId.Value);
        }

        var incomingTx = await query
            .OrderBy(t => t.TransactionDate)
            .ThenBy(t => t.Id)
            .ToListAsync();

        foreach (var tx in incomingTx)
        {
            if (remainingToDeplete <= 0)
                break;

            decimal take = Math.Min(tx.RemainingQuantity, remainingToDeplete);
            tx.RemainingQuantity -= take;
            remainingToDeplete -= take;

            allocations.Add(new FifoAllocation
            {
                SupplierId = tx.SupplierId,
                CostPrice = tx.CostPrice,
                Quantity = take
            });

            _context.StockTransactions.Update(tx);
        }

        // If there's still quantity remaining to deplete (e.g. overselling/negative stock),
        // attribute it to the product's default supplier and cost price
        if (remainingToDeplete > 0)
        {
            allocations.Add(new FifoAllocation
            {
                SupplierId = supplierId.HasValue && supplierId.Value > 0 ? supplierId.Value : product.SupplierId,
                CostPrice = product.CostPrice,
                Quantity = remainingToDeplete
            });
        }

        return allocations;
    }

    public async Task<StockTransaction> RecordTransactionAsync(
        int productId, 
        string type, 
        decimal qtyIn, 
        decimal qtyOut, 
        string reference,
        int? supplierId = null,
        decimal? costPrice = null)
    {
        var product = await _context.Products.FindAsync(productId);
        if (product == null)
            throw new ArgumentException("Product not found");

        // Calculate running balance based on latest transaction
        var lastTx = await CompiledQueries.GetLatestStockTransactionByProduct(_context, productId);

        decimal currentBalance = lastTx?.RunningBalance ?? 0;
        decimal newBalance = currentBalance + qtyIn - qtyOut;

        var resolvedSupplierId = supplierId ?? product.SupplierId;
        var resolvedCostPrice = costPrice ?? product.CostPrice;

        var tx = new StockTransaction
        {
            ProductId = productId,
            TransactionType = type,
            Reference = reference,
            QuantityIn = qtyIn,
            QuantityOut = qtyOut,
            RemainingQuantity = qtyIn, // Initialize remaining quantity for incoming stock
            RunningBalance = newBalance,
            SupplierId = resolvedSupplierId > 0 ? resolvedSupplierId : null,
            CostPrice = resolvedCostPrice,
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
