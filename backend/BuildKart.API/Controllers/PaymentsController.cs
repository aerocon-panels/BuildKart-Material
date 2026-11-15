using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Models;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Route("api/payments")]
public sealed class PaymentsController(
    BuildKartDbContext dbContext,
    IConfiguration configuration,
    OrderService orderService) : ControllerBase
{
    [HttpPost("checkout")]
    public async Task<ActionResult<PaymentOrderDto>> CreateCheckoutOrder(
        CreatePaymentCheckoutRequest request,
        CancellationToken cancellationToken)
    {
        var result = await orderService.CreateGuestOrderAsync(request, cancellationToken);
        if (result.Order is null)
        {
            return Problem(
                statusCode: result.ErrorStatus,
                title: "Checkout order could not be created.",
                detail: result.Error);
        }

        return CreatedAtAction(
            nameof(GetOrder),
            new { orderNumber = result.Order.OrderNumber },
            new PaymentOrderDto(
                result.Order.OrderNumber,
                result.Order.Total,
                0,
                result.Order.Total,
                result.Order.CreatedAtUtc));
    }

    [HttpGet("orders/{orderNumber}")]
    public async Task<ActionResult<PaymentOrderDto>> GetOrder(
        string orderNumber,
        CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .AsNoTracking()
            .Where(item => item.OrderNumber == orderNumber)
            .Select(item => new
            {
                item.OrderNumber,
                item.Total,
                item.CreatedAtUtc,
                PaidAmount = item.Payments
                    .Where(payment => payment.Status == PaymentStatuses.Paid)
                    .Sum(payment => (decimal?)payment.Amount) ?? 0
            })
            .SingleOrDefaultAsync(cancellationToken);

        return order is null
            ? NotFound(new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = "Order not found." })
            : Ok(new PaymentOrderDto(
                order.OrderNumber,
                order.Total,
                order.PaidAmount,
                Math.Max(0, order.Total - order.PaidAmount),
                order.CreatedAtUtc));
    }

    [HttpPost("orders/{orderNumber}/intents")]
    public async Task<ActionResult<PaymentDto>> CreateIntent(
        string orderNumber,
        CreatePaymentIntentRequest request,
        CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .Include(item => item.Payments)
            .SingleOrDefaultAsync(item => item.OrderNumber == orderNumber, cancellationToken);
        if (order is null)
        {
            return NotFound(new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = "Order not found." });
        }

        if (request.Method is "Card" or "NetBanking")
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Live card and net-banking payments are not configured.",
                detail: "No payment gateway merchant credentials are configured for this store.");
        }

        if (order.Payments.Any(payment =>
                payment.Status is PaymentStatuses.Pending or PaymentStatuses.Processing))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "A payment for this order is already being processed.",
                Detail = "Refresh the payment status before starting another payment."
            });
        }

        var amountDue = Math.Max(0, order.Total - order.Payments
            .Where(payment => payment.Status == PaymentStatuses.Paid)
            .Sum(payment => payment.Amount));
        if (amountDue <= 0)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "This order is already fully paid."
            });
        }

        var amount = request.PaymentType == "Advance"
            ? decimal.Round(order.Total * 0.20m, 2, MidpointRounding.AwayFromZero)
            : amountDue;
        if (amount <= 0 || amount > amountDue)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The selected payment amount is no longer due."
            });
        }

        var payment = new Payment
        {
            OrderId = order.Id,
            Amount = amount,
            Method = request.Method,
            PaymentType = request.PaymentType,
            Status = PaymentStatuses.Pending,
            TransactionReference = $"BK-{Guid.NewGuid():N}".ToUpperInvariant(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetTransaction),
            new { id = payment.Id },
            ToDto(payment, order.OrderNumber));
    }

    [HttpGet("transactions/{id:int}")]
    public async Task<ActionResult<PaymentDto>> GetTransaction(int id, CancellationToken cancellationToken)
    {
        var payment = await dbContext.Payments
            .AsNoTracking()
            .Include(item => item.Order)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return payment is null ? NotFound() : Ok(ToDto(payment, payment.Order.OrderNumber));
    }

    [HttpPost("transactions/{id:int}/processing")]
    public async Task<ActionResult<PaymentDto>> MarkProcessing(int id, CancellationToken cancellationToken)
    {
        var payment = await dbContext.Payments
            .Include(item => item.Order)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (payment is null)
        {
            return NotFound();
        }

        if (payment.Status == PaymentStatuses.Pending)
        {
            payment.Status = PaymentStatuses.Processing;
            payment.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(ToDto(payment, payment.Order.OrderNumber));
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> ReceiveVerifiedWebhook(CancellationToken cancellationToken)
    {
        var secret = configuration["Payments:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Payment confirmation is not configured.");
        }

        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 1024, true);
        var payload = await reader.ReadToEndAsync(cancellationToken);
        Request.Body.Position = 0;

        var suppliedSignature = Request.Headers["X-BuildKart-Signature"].ToString();
        if (suppliedSignature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            suppliedSignature = suppliedSignature["sha256=".Length..];
        }

        byte[] providedBytes;
        try
        {
            providedBytes = Convert.FromHexString(suppliedSignature);
        }
        catch (FormatException)
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Invalid payment signature."
            });
        }

        var expectedBytes = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload));
        if (providedBytes.Length != expectedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes))
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Invalid payment signature."
            });
        }

        PaymentWebhookRequest? confirmation;
        try
        {
            confirmation = JsonSerializer.Deserialize<PaymentWebhookRequest>(
                payload,
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch (JsonException)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid payment confirmation payload."
            });
        }

        if (confirmation is null ||
            string.IsNullOrWhiteSpace(confirmation.TransactionReference) ||
            confirmation.TransactionReference.Length > 100 ||
            string.IsNullOrWhiteSpace(confirmation.GatewayTransactionId) ||
            confirmation.GatewayTransactionId.Length > 100 ||
            confirmation.Amount <= 0 ||
            confirmation.Status is not (PaymentStatuses.Paid or PaymentStatuses.Failed))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Payment confirmation fields are invalid."
            });
        }

        var payment = await dbContext.Payments
            .SingleOrDefaultAsync(
                item => item.TransactionReference == confirmation.TransactionReference,
                cancellationToken);
        if (payment is null)
        {
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Payment transaction was not found."
            });
        }

        if (payment.Amount != confirmation.Amount)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Confirmed amount does not match the payment request."
            });
        }

        if (payment.Status is PaymentStatuses.Paid or PaymentStatuses.Failed)
        {
            return payment.Status == confirmation.Status &&
                   payment.GatewayTransactionId == confirmation.GatewayTransactionId
                ? Ok()
                : Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "This payment already has a different final status."
                });
        }

        if (await dbContext.Payments.AnyAsync(
                item => item.Id != payment.Id &&
                        item.GatewayTransactionId == confirmation.GatewayTransactionId,
                cancellationToken))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The gateway transaction ID has already been used."
            });
        }

        payment.GatewayTransactionId = confirmation.GatewayTransactionId;
        payment.Status = confirmation.Status;
        payment.UpdatedAtUtc = DateTimeOffset.UtcNow;
        payment.PaidAtUtc = confirmation.Status == PaymentStatuses.Paid ? DateTimeOffset.UtcNow : null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    private static PaymentDto ToDto(Payment payment, string orderNumber) => new(
        payment.Id,
        orderNumber,
        payment.Amount,
        payment.PaymentType,
        payment.Method,
        payment.Status,
        payment.TransactionReference,
        payment.GatewayTransactionId,
        payment.CreatedAtUtc,
        payment.UpdatedAtUtc,
        payment.PaidAtUtc);
}
