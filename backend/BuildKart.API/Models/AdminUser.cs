using System.ComponentModel.DataAnnotations;

namespace BuildKart.API.Models;

public sealed class AdminUser
{
    public int Id { get; set; }

    [Required, StringLength(100)]
    public string UserName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(500)]
    public string PasswordHash { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string Role { get; set; } = "Sales";

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
