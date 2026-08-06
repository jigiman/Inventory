using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class PurchaseReturn
{
    public int Id { get; set; }

    [Required]
    public string ReturnNumber { get; set; } = string.Empty;

    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public int? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    public DateTime ReturnDate { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    public string Notes { get; set; } = string.Empty;

    public string SettlementMethod { get; set; } = "StoreCredit"; // StoreCredit (Adjust on next purchase) or Refund (Immediate Cash/Check)

    public string PaymentMethod { get; set; } = string.Empty; // Cash, Cheque, Bank Transfer (if SettlementMethod == "Refund")

    public List<PurchaseReturnItem> Items { get; set; } = new();
}
