using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class Payment
{
    public int Id { get; set; }

    [Range(1, int.MaxValue)]
    public int OrderId { get; set; }

    [Range(typeof(decimal), "0.01", "9999999999999999")]
    public decimal Amount { get; set; }

    [Required, StringLength(30)]
    public string Method { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string PaymentType { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string Status { get; set; } = "Pending";

    [StringLength(100)]
    public string? TransactionReference { get; set; }

    [StringLength(100)]
    public string? GatewayTransactionId { get; set; }

    public DateTimeOffset? PaidAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public Order Order { get; set; } = null!;
}

public static class PaymentStatuses
{
    public const string Pending = "Pending";
    public const string Processing = "Processing";
    public const string Paid = "Paid";
    public const string Failed = "Failed";
}
