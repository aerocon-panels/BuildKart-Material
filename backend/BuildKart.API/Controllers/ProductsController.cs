using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Models;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController(BuildKartDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetAll(CancellationToken cancellationToken)
    {
        var products = await dbContext.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Where(product => product.IsActive && product.Category.IsActive)
            .OrderBy(product => product.Name)
            .Take(500)
            .Select(product => ToDto(product))
            .ToListAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var product = await dbContext.Products
            .AsNoTracking()
            .Include(item => item.Category)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return product is null ? NotFound() : Ok(ToDto(product));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<ActionResult<ProductDto>> Create(
        ProductRequest request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Categories.AnyAsync(
                category => category.Id == request.CategoryId && category.IsActive,
                cancellationToken))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.CategoryId)] = ["Select an existing active category."]
            }));
        }

        if (await dbContext.Products.AnyAsync(item => item.Sku == request.Sku.Trim(), cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "SKU already exists."
            });
        }

        var product = new Product();
        Apply(product, request);
        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync(cancellationToken);

        await dbContext.Entry(product).Reference(item => item.Category).LoadAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, ToDto(product));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<ActionResult<ProductDto>> Update(
        int id,
        ProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await dbContext.Products.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        if (!await dbContext.Categories.AnyAsync(
                category => category.Id == request.CategoryId && category.IsActive,
                cancellationToken))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.CategoryId)] = ["Select an existing active category."]
            }));
        }

        if (await dbContext.Products.AnyAsync(
                item => item.Id != id && item.Sku == request.Sku.Trim(),
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "SKU already exists."
            });
        }

        Apply(product, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        await dbContext.Entry(product).Reference(item => item.Category).LoadAsync(cancellationToken);
        return Ok(ToDto(product));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var product = await dbContext.Products.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        if (await dbContext.OrderItems.AnyAsync(item => item.ProductId == id, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Product is referenced by an order.",
                Detail = "Deactivate the product instead of deleting its order history."
            });
        }

        dbContext.Products.Remove(product);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Product product, ProductRequest request)
    {
        product.Sku = request.Sku.Trim();
        product.Name = request.Name.Trim();
        product.Description = request.Description?.Trim();
        product.Specification = request.Specification?.Trim();
        product.UnitPrice = request.UnitPrice;
        product.UnitOfMeasure = request.UnitOfMeasure.Trim();
        product.CategoryId = request.CategoryId;
        product.IsActive = request.IsActive;
    }

    private static ProductDto ToDto(Product product) => new(
        product.Id,
        product.Sku,
        product.Name,
        product.Description,
        product.Specification,
        product.UnitPrice,
        product.UnitOfMeasure,
        product.CategoryId,
        product.Category.Name,
        product.IsActive);
}
