using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Models;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.Staff)]
[Route("api/[controller]")]
public sealed class CustomersController(BuildKartDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> GetAll(CancellationToken cancellationToken)
    {
        var customers = await dbContext.Customers
            .AsNoTracking()
            .OrderByDescending(customer => customer.CreatedAtUtc)
            .Take(500)
            .Select(customer => ToDto(customer))
            .ToListAsync(cancellationToken);
        return Ok(customers);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CustomerDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return customer is null ? NotFound() : Ok(ToDto(customer));
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create(
        CustomerRequest request,
        CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        if (email is not null &&
            await dbContext.Customers.AnyAsync(item => item.Email == email, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Customer email already exists."
            });
        }

        var customer = new Customer();
        Apply(customer, request);
        dbContext.Customers.Add(customer);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, ToDto(customer));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CustomerDto>> Update(
        int id,
        CustomerRequest request,
        CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (customer is null)
        {
            return NotFound();
        }

        var email = NormalizeEmail(request.Email);
        if (email is not null &&
            await dbContext.Customers.AnyAsync(
                item => item.Id != id && item.Email == email,
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Customer email already exists."
            });
        }

        Apply(customer, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(customer));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (customer is null)
        {
            return NotFound();
        }

        if (await dbContext.Orders.AnyAsync(item => item.CustomerId == id, cancellationToken) ||
            await dbContext.Quotations.AnyAsync(item => item.CustomerId == id, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Customer has order or quotation history.",
                Detail = "Retain the customer record to preserve its history."
            });
        }

        dbContext.Customers.Remove(customer);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Customer customer, CustomerRequest request)
    {
        customer.Name = request.Name.Trim();
        customer.Email = NormalizeEmail(request.Email);
        customer.Phone = request.Phone.Trim();
        customer.Address = request.Address?.Trim();
        customer.PostalCode = request.PostalCode?.Trim();
    }

    private static CustomerDto ToDto(Customer customer) => new(
        customer.Id,
        customer.Name,
        customer.Email,
        customer.Phone,
        customer.Address,
        customer.PostalCode,
        customer.CreatedAtUtc);

    private static string? NormalizeEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null : email.Trim();
}
