using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Charge
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal DefaultAmount { get; set; }

    public string Description { get; set; } = string.Empty;

    public bool IsArchived { get; set; } = false;
}
