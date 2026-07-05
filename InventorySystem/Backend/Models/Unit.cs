using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class Unit
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
}
