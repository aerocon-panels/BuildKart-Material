using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.DTOs;

public sealed record CategoryDto(int Id, string Name, string? Description, bool IsActive);

public sealed class CategoryRequest
{
    [Required, StringLength(100)]
    public string Name { get; init; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; init; }

    public bool IsActive { get; init; } = true;
}
