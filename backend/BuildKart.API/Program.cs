using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using BuildKart.API.Data;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("BuildKart");
var databaseConfigured = !string.IsNullOrWhiteSpace(connectionString);
builder.Services.AddDbContext<BuildKartDbContext>(options =>
{
    if (databaseConfigured)
    {
        options.UseSqlServer(connectionString);
    }
});

var signingKey = builder.Configuration["Authentication:Jwt:SigningKey"];
var configuredSigningKey = !string.IsNullOrWhiteSpace(signingKey);
if (!configuredSigningKey)
{
    signingKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
}

var signingKeyBytes = Encoding.UTF8.GetBytes(signingKey!);
if (signingKeyBytes.Length < 32)
{
    throw new InvalidOperationException(
        "Authentication:Jwt:SigningKey must contain at least 32 UTF-8 bytes.");
}

var issuer = builder.Configuration["Authentication:Jwt:Issuer"] ?? "BuildKart.API";
var audience = builder.Configuration["Authentication:Jwt:Audience"] ?? "BuildKart.React";
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(signingKeyBytes),
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.Staff, policy =>
        policy.RequireRole(AuthorizationPolicies.AdminRole, AuthorizationPolicies.SalesRole));
    options.AddPolicy(AuthorizationPolicies.AdminOnly, policy =>
        policy.RequireRole(AuthorizationPolicies.AdminRole));
});

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:5173"];
if (allowedOrigins.Length == 0 || allowedOrigins.Any(origin =>
        !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)))
{
    throw new InvalidOperationException(
        "Cors:AllowedOrigins must contain at least one valid HTTP or HTTPS origin.");
}

builder.Services.AddCors(options =>
    options.AddPolicy("ReactFrontend", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var taxRateSetting = builder.Configuration["Sales:TaxRate"] ?? "0.18";
if (!decimal.TryParse(taxRateSetting, NumberStyles.Number, CultureInfo.InvariantCulture, out var taxRate) ||
    taxRate is < 0 or > 1)
{
    throw new InvalidOperationException("Sales:TaxRate must be a decimal between 0 and 1.");
}

builder.Services.AddSingleton(new SalesTaxPolicy(taxRate));
builder.Services.AddScoped<OrderService>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddControllers();

var app = builder.Build();

if (!databaseConfigured)
{
    app.Logger.LogWarning(
        "No database connection is configured. API data routes will return 503; no database connection will be attempted.");
}

if (!configuredSigningKey)
{
    app.Logger.LogWarning(
        "No JWT signing key is configured. A temporary process-local key is in use; configure Authentication:Jwt:SigningKey to validate persistent tokens.");
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseHttpsRedirection();
app.UseCors("ReactFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<DatabaseAvailabilityMiddleware>();
app.MapControllers();

app.Run();
