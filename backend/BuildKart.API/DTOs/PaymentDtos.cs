using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.DTOs;

public sealed record PaymentOrderDto(
    string OrderNumber,
    decimal Total,
    decimal PaidAmount,
    decimal AmountDue,
    DateTimeOffset CreatedAtUtc);

public sealed record PaymentDto(
    int Id,
    string OrderNumber,
    decimal Amount,
    string PaymentType,
    string Method,
    string Status,
    string? TransactionReference,
    string? GatewayTransactionId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? PaidAtUtc);

public sealed class CreatePaymentIntentRequest
{
    [Required, RegularExpression("^(FullPayment|Advance)$")]
    public string PaymentType { get; init; } = string.Empty;

    [Required, RegularExpression("^(UPI|Card|NetBanking)$")]
    public string Method { get; init; } = string.Empty;
}

public sealed class CreatePaymentCheckoutRequest
{
    [Required, StringLength(150)]
    public string CustomerName { get; init; } = string.Empty;

    [Required, RegularExpression(@"^\+?[0-9\s()-]{7,20}$")]
    public string CustomerPhone { get; init; } = string.Empty;

    [StringLength(300)]
    public string? SiteAddress { get; init; }

    [StringLength(20)]
    public string? PostalCode { get; init; }

    [Required, MinLength(1)]
    public List<CreateOrderItemRequest> Items { get; init; } = [];
}

public sealed class PaymentWebhookRequest
{
    [Required, StringLength(100)]
    public string TransactionReference { get; init; } = string.Empty;

    [Required, StringLength(100)]
    public string GatewayTransactionId { get; init; } = string.Empty;

    [Range(typeof(decimal), "0.01", "9999999999999999")]
    public decimal Amount { get; init; }

    [Required, RegularExpression("^(Paid|Failed)$")]
    public string Status { get; init; } = string.Empty;
}
