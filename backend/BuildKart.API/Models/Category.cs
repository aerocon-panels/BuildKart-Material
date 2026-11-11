using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Category
{
    public int Id { get; set; }

    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
