using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class SalesReturn
{
    public int Id { get; set; }

    [Required]
    public string ReturnNumber { get; set; } = string.Empty;

    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int? SaleId { get; set; }
    public Sale? Sale { get; set; }

    public DateTime ReturnDate { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    public string Notes { get; set; } = string.Empty;

    public List<SalesReturnItem> Items { get; set; } = new();
}
