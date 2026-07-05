using System;
using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class AuditLog
{
    public int Id { get; set; }
    
    public DateTime Timestamp { get; set; }
    
    [Required]
    public string Action { get; set; } = string.Empty;
    
    [Required]
    public string EntityType { get; set; } = string.Empty;
    
    public string EntityId { get; set; } = string.Empty;
    
    public string Details { get; set; } = string.Empty;
}
