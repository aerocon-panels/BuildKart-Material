using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.DTOs;

public sealed record CustomerDto(
    int Id,
    string Name,
    string? Email,
    string Phone,
    string? Address,
    string? PostalCode,
    DateTimeOffset CreatedAtUtc);

public sealed class CustomerRequest
{
    [Required, StringLength(150)]
    public string Name { get; init; } = string.Empty;

    [EmailAddress, StringLength(254)]
    public string? Email { get; init; }

    [Required, RegularExpression(@"^\+?[0-9\s()-]{7,20}$")]
    public string Phone { get; init; } = string.Empty;

    [StringLength(300)]
    public string? Address { get; init; }

    [StringLength(20)]
    public string? PostalCode { get; init; }
}
