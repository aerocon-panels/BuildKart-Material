using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Quotation
{
    public int Id { get; set; }

    [Required, StringLength(20)]
    public string QuoteNumber { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }

    [Required, StringLength(30)]
    public string Status { get; set; } = "Draft";

    public decimal Subtotal { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public DateTimeOffset? ValidUntilUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public Customer Customer { get; set; } = null!;
}
