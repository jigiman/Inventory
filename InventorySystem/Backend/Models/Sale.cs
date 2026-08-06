using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Sale
{
    public int Id { get; set; }

    [Required]
    public string SaleNumber { get; set; } = string.Empty;

    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public DateTime SaleDate { get; set; }

    [Required]
    public string Status { get; set; } = "Completed"; // Completed, Cancelled

    [Column(TypeName = "decimal(18,2)")]
    public decimal SubTotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    public string Notes { get; set; } = string.Empty;

    public List<SaleItem> Items { get; set; } = new();
    public List<SaleCharge> Charges { get; set; } = new();
}

