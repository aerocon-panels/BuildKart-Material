using Microsoft.AspNetCore.Mvc;

namespace BuildKart.API.Services;

public sealed class DatabaseAvailabilityMiddleware(RequestDelegate next, IConfiguration configuration)
{
    private readonly bool _databaseConfigured =
        !string.IsNullOrWhiteSpace(configuration.GetConnectionString("BuildKart"));

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_databaseConfigured && context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Database is not configured",
                Detail = "Set the BuildKart connection string in secure backend configuration to use API data routes.",
                Instance = context.Request.Path
            });
            return;
        }

        await next(context);
    }
}
