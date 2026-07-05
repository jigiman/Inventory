using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class StockTransaction
{
    public int Id { get; set; }
    
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    [Required]
    public string TransactionType { get; set; } = string.Empty; // OpeningStock, Purchase, AdjustmentPlus, AdjustmentMinus, Damaged, Expired, StockCountAdjustment
    
    public string Reference { get; set; } = string.Empty;
    
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal RunningBalance { get; set; }
    
    public DateTime TransactionDate { get; set; }
}
