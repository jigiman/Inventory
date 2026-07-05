using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class InventorySnapshot
{
    public int Id { get; set; }
    
    public DateTime SnapshotDate { get; set; }
    
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    public decimal Quantity { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Valuation { get; set; }
}
