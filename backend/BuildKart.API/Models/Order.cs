using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Order
{
    public int Id { get; set; }

    [Required, StringLength(20)]
    public string OrderNumber { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }

    [Required, StringLength(30)]
    public string Status { get; set; } = "Pending";

    public decimal Subtotal { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }

    [StringLength(1000)]
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public Customer Customer { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
