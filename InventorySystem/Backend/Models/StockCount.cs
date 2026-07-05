using System;
using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class StockCount
{
    public int Id { get; set; }
    
    public DateTime CountDate { get; set; }
    
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    public decimal SystemQuantity { get; set; }
    public decimal PhysicalQuantity { get; set; }
    public decimal Difference { get; set; }
    
    public string Remarks { get; set; } = string.Empty;
}
