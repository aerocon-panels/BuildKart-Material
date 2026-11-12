using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Services;

public sealed class OrderService(BuildKartDbContext dbContext, SalesTaxPolicy taxPolicy)
{
    public async Task<(Order? Order, int? ErrorStatus, string? Error)> CreateGuestOrderAsync(
        CreatePaymentCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count > 50)
        {
            return (null, StatusCodes.Status400BadRequest, "An order cannot contain more than 50 items.");
        }

        if (request.Items.Select(item => item.ProductId).Distinct().Count() != request.Items.Count)
        {
            return (null, StatusCodes.Status400BadRequest, "Each product may appear only once in an order.");
        }

        var productIds = request.Items.Select(item => item.ProductId).ToArray();
        var products = await dbContext.Products
            .Where(item => productIds.Contains(item.Id) && item.IsActive)
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        if (products.Count != productIds.Length)
        {
            return (null, StatusCodes.Status400BadRequest, "One or more products do not exist or are inactive.");
        }

        var customer = new Customer
        {
            Name = request.CustomerName.Trim(),
            Phone = request.CustomerPhone.Trim(),
            Address = request.SiteAddress?.Trim(),
            PostalCode = request.PostalCode?.Trim()
        };
        var order = new Order
        {
            Customer = customer,
            OrderNumber = $"BK-{Guid.NewGuid():N}"[..13].ToUpperInvariant(),
            Status = "Pending",
            TaxRate = taxPolicy.Rate,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        foreach (var requestedItem in request.Items)
        {
            var product = products[requestedItem.ProductId];
            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                Product = product,
                Quantity = requestedItem.Quantity,
                UnitPriceAtOrder = product.UnitPrice
            });
        }

        order.Subtotal = order.Items.Sum(item => item.Quantity * item.UnitPriceAtOrder);
        order.TaxAmount = decimal.Round(order.Subtotal * order.TaxRate, 2, MidpointRounding.AwayFromZero);
        order.Total = order.Subtotal + order.TaxAmount;

        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);
        return (order, null, null);
    }

    public async Task<(Order? Order, int? ErrorStatus, string? Error)> CreateAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count > 50)
        {
            return (null, StatusCodes.Status400BadRequest, "An order cannot contain more than 50 items.");
        }

        if (request.Items.Select(item => item.ProductId).Distinct().Count() != request.Items.Count)
        {
            return (null, StatusCodes.Status400BadRequest, "Each product may appear only once in an order.");
        }

        var customer = await dbContext.Customers
            .SingleOrDefaultAsync(item => item.Id == request.CustomerId, cancellationToken);
        if (customer is null)
        {
            return (null, StatusCodes.Status404NotFound, "The specified customer was not found.");
        }

        var productIds = request.Items.Select(item => item.ProductId).ToArray();
        var products = await dbContext.Products
            .Where(item => productIds.Contains(item.Id) && item.IsActive)
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        if (products.Count != productIds.Length)
        {
            return (null, StatusCodes.Status400BadRequest, "One or more products do not exist or are inactive.");
        }

        var order = new Order
        {
            CustomerId = customer.Id,
            Customer = customer,
            OrderNumber = $"BK-{Guid.NewGuid():N}"[..13].ToUpperInvariant(),
            Status = "Pending",
            TaxRate = taxPolicy.Rate,
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        foreach (var requestedItem in request.Items)
        {
            var product = products[requestedItem.ProductId];
            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                Product = product,
                Quantity = requestedItem.Quantity,
                UnitPriceAtOrder = product.UnitPrice
            });
        }

        order.Subtotal = order.Items.Sum(item => item.Quantity * item.UnitPriceAtOrder);
        order.TaxAmount = decimal.Round(order.Subtotal * order.TaxRate, 2, MidpointRounding.AwayFromZero);
        order.Total = order.Subtotal + order.TaxAmount;

        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (order, null, null);
    }
}
