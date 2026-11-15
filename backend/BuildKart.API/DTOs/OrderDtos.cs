using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.DTOs;

public sealed record OrderItemDto(
    int ProductId,
    string ProductName,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record OrderDto(
    int Id,
    string OrderNumber,
    int CustomerId,
    string CustomerName,
    string Status,
    decimal Subtotal,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Total,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<OrderItemDto> Items);

public sealed class CreateOrderRequest
{
    [Range(1, int.MaxValue)]
    public int CustomerId { get; init; }

    [Required, MinLength(1)]
    public List<CreateOrderItemRequest> Items { get; init; } = [];

    [StringLength(1000)]
    public string? Notes { get; init; }
}

public sealed class CreateOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; init; }

    [Range(typeof(decimal), "0.001", "100000")]
    public decimal Quantity { get; init; }
}
