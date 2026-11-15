using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.Staff)]
[Route("api/[controller]")]
public sealed class OrdersController(BuildKartDbContext dbContext, OrderService orderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> GetAll(CancellationToken cancellationToken)
    {
        var orders = await dbContext.Orders
            .AsNoTracking()
            .Include(order => order.Customer)
            .Include(order => order.Items)
                .ThenInclude(item => item.Product)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .AsNoTracking()
            .Include(item => item.Customer)
            .Include(item => item.Items)
                .ThenInclude(item => item.Product)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return order is null ? NotFound() : Ok(ToDto(order));
    }

    [HttpPost]
    public async Task<ActionResult<OrderDto>> Create(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await orderService.CreateAsync(request, cancellationToken);
        if (result.Order is null)
        {
            return Problem(
                statusCode: result.ErrorStatus,
                title: "Order could not be created.",
                detail: result.Error);
        }

        var order = await dbContext.Orders
            .AsNoTracking()
            .Include(item => item.Customer)
            .Include(item => item.Items)
                .ThenInclude(item => item.Product)
            .SingleAsync(item => item.Id == result.Order.Id, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, ToDto(order));
    }

    private static OrderDto ToDto(Models.Order order) => new(
        order.Id,
        order.OrderNumber,
        order.CustomerId,
        order.Customer.Name,
        order.Status,
        order.Subtotal,
        order.TaxRate,
        order.TaxAmount,
        order.Total,
        order.Notes,
        order.CreatedAtUtc,
        order.Items
            .OrderBy(item => item.Id)
            .Select(item => new OrderItemDto(
                item.ProductId,
                item.Product.Name,
                item.Quantity,
                item.UnitPriceAtOrder,
                item.LineTotal))
            .ToList());
}
