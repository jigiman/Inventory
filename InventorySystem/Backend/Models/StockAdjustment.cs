using System;
using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class StockAdjustment
{
    public int Id { get; set; }
    
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    [Required]
    public string AdjustmentType { get; set; } = string.Empty; // Plus, Minus, Damaged, Expired
    
    public decimal Quantity { get; set; }
    
    public string Reason { get; set; } = string.Empty;
    
    public DateTime CreatedDate { get; set; }
}
