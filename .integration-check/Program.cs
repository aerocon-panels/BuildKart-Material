using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

const string userSecretsId = "dd456319-ce7c-4f24-a08e-09b7bd799a3f";
const string apiOrigin = "http://localhost:5001";
const string issuer = "BuildKart.API";
const string audience = "BuildKart.React";

var secretsPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
    "Microsoft",
    "UserSecrets",
    userSecretsId,
    "secrets.json");
using var secretDocument = JsonDocument.Parse(await File.ReadAllTextAsync(secretsPath));
var root = secretDocument.RootElement;
string? signingKey = null;
if (root.TryGetProperty("Authentication:Jwt:SigningKey", out var flatKey))
{
    signingKey = flatKey.GetString();
}
else if (root.TryGetProperty("Authentication", out var authentication) &&
         authentication.TryGetProperty("Jwt", out var jwt) &&
         jwt.TryGetProperty("SigningKey", out var nestedKey))
{
    signingKey = nestedKey.GetString();
}

if (string.IsNullOrWhiteSpace(signingKey))
{
    Console.Error.WriteLine("Integration test stopped: API JWT signing key is not configured in User Secrets.");
    return 1;
}

var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
var header = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" }));
var payload = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new
{
    iss = issuer,
    aud = audience,
    sub = "buildkart-integration-check",
    role = "Sales",
    nbf = now - 5,
    exp = now + 300
}));
var unsignedToken = $"{header}.{payload}";
var signature = HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.ASCII.GetBytes(unsignedToken));
var token = $"{unsignedToken}.{Base64Url(signature)}";

using var client = new HttpClient { BaseAddress = new Uri(apiOrigin) };
var allPassed = true;

foreach (var route in new[] { "Products", "Categories" })
{
    using var response = await client.GetAsync($"/api/{route}");
    var json = await response.Content.ReadAsStringAsync();
    var count = response.IsSuccessStatusCode
        ? (JsonDocument.Parse(json).RootElement.GetArrayLength())
        : -1;
    Console.WriteLine($"GET /api/{route}: {(int)response.StatusCode}; rows: {count}.");
    allPassed &= response.StatusCode == System.Net.HttpStatusCode.OK && count >= 0;

    using var missingResponse = await client.GetAsync($"/api/{route}/2147483647");
    Console.WriteLine($"GET /api/{route}/2147483647: {(int)missingResponse.StatusCode} (expected 404).");
    allPassed &= missingResponse.StatusCode == System.Net.HttpStatusCode.NotFound;
}

foreach (var route in new[] { "Customers", "Orders" })
{
    using var authorizedRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/{route}");
    authorizedRequest.Headers.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    using var authorizedResponse = await client.SendAsync(authorizedRequest);
    var json = await authorizedResponse.Content.ReadAsStringAsync();
    var count = authorizedResponse.IsSuccessStatusCode
        ? JsonDocument.Parse(json).RootElement.GetArrayLength()
        : -1;
    Console.WriteLine($"GET /api/{route} (Sales JWT): {(int)authorizedResponse.StatusCode}; rows: {count}.");
    allPassed &= authorizedResponse.StatusCode == System.Net.HttpStatusCode.OK && count >= 0;

    using var anonymousResponse = await client.GetAsync($"/api/{route}");
    Console.WriteLine($"GET /api/{route} (anonymous): {(int)anonymousResponse.StatusCode}.");
    allPassed &= anonymousResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized;

    using var missingRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/{route}/2147483647");
    missingRequest.Headers.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    using var missingResponse = await client.SendAsync(missingRequest);
    Console.WriteLine($"GET /api/{route}/2147483647 (Sales JWT): {(int)missingResponse.StatusCode} (expected 404).");
    allPassed &= missingResponse.StatusCode == System.Net.HttpStatusCode.NotFound;
}

foreach (var route in new[] { "Products", "Categories", "Customers", "Orders" })
{
    using var writeRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/{route}")
    {
        Content = new StringContent("{}", Encoding.UTF8, "application/json")
    };
    using var writeResponse = await client.SendAsync(writeRequest);
    Console.WriteLine($"POST /api/{route} (anonymous): {(int)writeResponse.StatusCode} (expected 401).");
    allPassed &= writeResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized;
}

using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/Products");
preflight.Headers.Add("Origin", "http://localhost:5173");
preflight.Headers.Add("Access-Control-Request-Method", "GET");
using var corsResponse = await client.SendAsync(preflight);
var corsAllowed = corsResponse.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins) &&
                  origins.Contains("http://localhost:5173");
Console.WriteLine($"CORS preflight for http://localhost:5173: {(corsAllowed ? "allowed" : "not allowed")}.");
allPassed &= corsAllowed;

Console.WriteLine($"Integration checks: {(allPassed ? "passed" : "failed")}. No records were written.");
return allPassed ? 0 : 1;

static string Base64Url(byte[] value) =>
    Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
