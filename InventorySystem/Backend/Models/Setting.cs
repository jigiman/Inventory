using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class Setting
{
    public int Id { get; set; }
    
    [Required]
    public string Key { get; set; } = string.Empty;
    
    public string Value { get; set; } = string.Empty;
}
