using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class PurchaseOrderCharge
{
    public int Id { get; set; }

    public int PurchaseOrderId { get; set; }

    [JsonIgnore]
    public PurchaseOrder? PurchaseOrder { get; set; }

    public int? ChargeId { get; set; }

    [Required]
    public string ChargeName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }
}
