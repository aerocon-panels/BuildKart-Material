using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Customer
{
    public int Id { get; set; }

    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [EmailAddress, StringLength(254)]
    public string? Email { get; set; }

    [Required, RegularExpression(@"^\+?[0-9\s()-]{7,20}$")]
    public string Phone { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Address { get; set; }

    [StringLength(20)]
    public string? PostalCode { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();
}
