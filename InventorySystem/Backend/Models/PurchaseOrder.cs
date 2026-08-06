using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class PurchaseOrder
{
    public int Id { get; set; }
    
    [Required]
    public string OrderNumber { get; set; } = string.Empty;
    
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    
    public DateTime OrderDate { get; set; }
    
    [Required]
    public string Status { get; set; } = "Draft"; // Draft, Ordered, Received, Cancelled
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }
    
    public string Notes { get; set; } = string.Empty;
    
    public List<PurchaseItem> Items { get; set; } = new();
    public List<PurchaseOrderCharge> Charges { get; set; } = new();
}

