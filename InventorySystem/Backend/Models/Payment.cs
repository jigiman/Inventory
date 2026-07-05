using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Payment
{
    public int Id { get; set; }

    public DateTime PaymentDate { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [Required]
    public string PaymentMethod { get; set; } = "Cash"; // Cash, Bank, Cheque, etc.

    public string Reference { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;

    // A payment can be from a Customer (Receipt) or to a Supplier (Payment)
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    // Optional: Link to a specific transaction
    public int? SaleId { get; set; }
    public Sale? Sale { get; set; }

    public int? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
}
