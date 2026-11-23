using BuildKart.API.Data;
using BuildKart.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Route("api/customer-signup")]
public sealed class CustomerSignupController(BuildKartDbContext dbContext) : ControllerBase
{
    public sealed record SignupRequest(string? Name, string? Phone);

    [HttpPost]
    public async Task<IActionResult> SignUp(SignupRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? "";
        var phone = new string((request.Phone ?? "").Where(char.IsDigit).ToArray());

        if (name.Length < 2 || phone.Length != 10)
            return BadRequest("Enter a valid name and 10-digit phone number.");

        var existing = await dbContext.Customers
            .FirstOrDefaultAsync(c => c.Phone == phone, cancellationToken);
        if (existing is not null)
            return Ok(new { id = existing.Id, name = existing.Name, phone = existing.Phone });

        var customer = new Customer
        {
            Name = name,
            Phone = phone,
            Email = "",
            Address = "",
            PostalCode = "",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        dbContext.Customers.Add(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { id = customer.Id, name = customer.Name, phone = customer.Phone });
    }
}