using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Product
{
    public int Id { get; set; }
    
    [Required]
    public string SKU { get; set; } = string.Empty;
    
    [Required]
    public string Name { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    
    public int BrandId { get; set; }
    public Brand? Brand { get; set; }
    
    public int UnitId { get; set; }
    public Unit? Unit { get; set; }
    
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal CostPrice { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal SellingPrice { get; set; }
    
    public decimal OpeningQuantity { get; set; }
    public decimal CurrentQuantity { get; set; }
    public decimal ReorderLevel { get; set; }
    public decimal MaximumStock { get; set; }
    public string ShelfLocation { get; set; } = string.Empty;
    public int LeadTime { get; set; } // in days
    public string ProductImage { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string Notes { get; set; } = string.Empty;
}
