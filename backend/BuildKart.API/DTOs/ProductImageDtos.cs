using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;

namespace BuildKart.API.DTOs;

public sealed class ProductImageUploadRequest
{
    [Required]
    [FromForm(Name = "file")]
    public IFormFile? File { get; set; }

    [Required, StringLength(200)]
    public string Image { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string Thickness { get; set; } = string.Empty;

    [StringLength(100)]
    public string? SizeLabel { get; set; }
}

public sealed record ProductImageDto(
    int Id,
    string Image,
    string Thickness,
    string? SizeLabel,
    string ImageUrl,
    int SortOrder,
    bool IsActive,
    DateTime CreatedAtUtc);
