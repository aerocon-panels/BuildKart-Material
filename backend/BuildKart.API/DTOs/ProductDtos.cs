using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.DTOs;

public sealed record ProductDto(
    int Id,
    string Sku,
    string Name,
    string? Description,
    string? Specification,
    decimal UnitPrice,
    string UnitOfMeasure,
    int CategoryId,
    string CategoryName,
    bool IsActive);

public sealed class ProductRequest
{
    [Required, StringLength(50)]
    public string Sku { get; init; } = string.Empty;

    [Required, StringLength(200)]
    public string Name { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; init; }

    [StringLength(200)]
    public string? Specification { get; init; }

    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal UnitPrice { get; init; }

    [Required, StringLength(30)]
    public string UnitOfMeasure { get; init; } = "piece";

    [Range(1, int.MaxValue)]
    public int CategoryId { get; init; }

    public bool IsActive { get; init; } = true;
}
