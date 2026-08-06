using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class SaleCharge
{
    public int Id { get; set; }

    public int SaleId { get; set; }

    [JsonIgnore]
    public Sale? Sale { get; set; }

    public int? ChargeId { get; set; }

    [Required]
    public string ChargeName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }
}
