using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Product
{
    public int Id { get; set; }

    [Required, StringLength(50)]
    public string Sku { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [StringLength(200)]
    public string? Specification { get; set; }

    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal UnitPrice { get; set; }

    [Required, StringLength(30)]
    public string UnitOfMeasure { get; set; } = "piece";

    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public Category Category { get; set; } = null!;
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
