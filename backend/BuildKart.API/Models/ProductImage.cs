namespace BuildKart.API.Models;

public sealed class ProductImage
{
    public int Id { get; set; }
    public string Image { get; set; } = string.Empty;
    public string Thickness { get; set; } = string.Empty;
    public string? SizeLabel { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
