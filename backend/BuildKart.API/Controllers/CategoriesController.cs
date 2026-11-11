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
public sealed class CategoriesController(BuildKartDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var categories = await dbContext.Categories
            .AsNoTracking()
            .Where(category => category.IsActive)
            .OrderBy(category => category.Name)
            .Take(200)
            .Select(category => ToDto(category))
            .ToListAsync(cancellationToken);
        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<CategoryDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return category is null ? NotFound() : Ok(ToDto(category));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<ActionResult<CategoryDto>> Create(
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        if (await dbContext.Categories.AnyAsync(item => item.Name == request.Name.Trim(), cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Category name already exists."
            });
        }

        var category = new Category();
        Apply(category, request);
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, ToDto(category));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<ActionResult<CategoryDto>> Update(
        int id,
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (category is null)
        {
            return NotFound();
        }

        if (await dbContext.Categories.AnyAsync(
                item => item.Id != id && item.Name == request.Name.Trim(),
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Category name already exists."
            });
        }

        Apply(category, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(category));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (category is null)
        {
            return NotFound();
        }

        if (await dbContext.Products.AnyAsync(item => item.CategoryId == id, cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Category contains products.",
                Detail = "Move or remove its products before deleting the category."
            });
        }

        dbContext.Categories.Remove(category);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Category category, CategoryRequest request)
    {
        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();
        category.IsActive = request.IsActive;
    }

    private static CategoryDto ToDto(Category category) =>
        new(category.Id, category.Name, category.Description, category.IsActive);
}
