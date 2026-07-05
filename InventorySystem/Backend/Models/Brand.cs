using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class Brand
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public bool IsArchived { get; set; }
}
