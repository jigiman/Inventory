using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class PurchaseItem
{
    public int Id { get; set; }
    
    public int PurchaseOrderId { get; set; }
    
    [JsonIgnore]
    public PurchaseOrder? PurchaseOrder { get; set; }
    
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    public decimal QuantityOrdered { get; set; }
    public decimal QuantityReceived { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }
}
