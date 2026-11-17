using System.Data;
using System.Text.RegularExpressions;
using BuildKart.API.Data;
using BuildKart.API.DTOs;
using BuildKart.API.Models;
using BuildKart.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Controllers;

[ApiController]
[Route("api/product-images")]
public sealed class ProductImagesController(
    BuildKartDbContext dbContext,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    ILogger<ProductImagesController> logger) : ControllerBase
{
    private const long MaxFileSize = 10 * 1024 * 1024;
    private const long MaxRequestSize = MaxFileSize + 64 * 1024;
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    private static readonly Regex SizeLabelPattern = new(
        @"^\d+(?:\.\d+)?ft$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<ProductImageDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var images = await dbContext.ProductImages
            .AsNoTracking()
            .Where(image => image.IsActive)
            .OrderBy(image => image.SortOrder)
            .ThenByDescending(image => image.CreatedAtUtc)
            .Select(image => ToDto(image))
            .ToListAsync(cancellationToken);

        return Ok(images);
    }

    [HttpPost("upload")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxRequestSize)]
    public async Task<ActionResult<ProductImageDto>> Upload(
        [FromForm] ProductImageUploadRequest request,
        CancellationToken cancellationToken)
    {
        var file = request.File;
        if (file is null || file.Length == 0)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.File)] = ["Choose an image file to upload."]
            }));
        }

        if (file.Length > MaxFileSize)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new ProblemDetails
            {
                Status = StatusCodes.Status413PayloadTooLarge,
                Title = "Image file is too large.",
                Detail = "Choose an image no larger than 10 MB."
            });
        }

        var image = request.Image.Trim();
        if (!Regex.IsMatch(image, "^[a-zA-Z0-9_-]{1,200}$"))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Image)] = ["Use letters, numbers, hyphens, or underscores for the image key."]
            }));
        }

        var thickness = request.Thickness.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(thickness, @"^\d+(?:\.\d+)?mm$"))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Thickness)] = ["Thickness must be a value such as 75mm or 50mm."]
            }));
        }

        var sizeLabel = string.IsNullOrWhiteSpace(request.SizeLabel)
            ? ProductImageWatcherService.GetSizeLabelFromFileName(file.FileName)
            : request.SizeLabel.Trim().ToLowerInvariant();
        if (sizeLabel is not null && !SizeLabelPattern.IsMatch(sizeLabel))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.SizeLabel)] = ["Use a size label such as 8ft, 9ft, or 10ft."]
            }));
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!await HasSupportedImageSignatureAsync(file, extension, cancellationToken))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.File)] = ["Upload a valid PNG, JPEG, or WebP image."]
            }));
        }

        var imageRootSetting = configuration["ImageRoot"];
        if (string.IsNullOrWhiteSpace(imageRootSetting))
        {
            throw new InvalidOperationException("ImageRoot must be configured in appsettings.json.");
        }

        var imageRoot = Path.GetFullPath(imageRootSetting, environment.ContentRootPath);
        var thicknessFolder = Path.Combine(imageRoot, thickness);
        Directory.CreateDirectory(thicknessFolder);

        var sizeFilePrefix = sizeLabel is null ? string.Empty : $"{sizeLabel[..^2]}x2ft_";
        var fileName = $"{sizeFilePrefix}{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(thicknessFolder, fileName);
        var imageUrl = $"/product-images/{thickness}/{fileName}";

        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var productImage = await dbContext.ProductImages.FirstOrDefaultAsync(
            item => item.Image == image
                && item.Thickness == thickness
                && item.SizeLabel == sizeLabel,
            cancellationToken);

        if (productImage is null)
        {
            productImage = new ProductImage
            {
                Image = image,
                Thickness = thickness,
                SizeLabel = sizeLabel
            };
            dbContext.ProductImages.Add(productImage);
        }

        productImage.ImageUrl = imageUrl;
        productImage.SortOrder = 1;
        productImage.IsActive = true;
        productImage.CreatedAtUtc = DateTime.UtcNow;

        await using (var destination = new FileStream(
            filePath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true))
        {
            await file.CopyToAsync(destination, cancellationToken);
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            try
            {
                System.IO.File.Delete(filePath);
            }
            catch (IOException cleanupException)
            {
                logger.LogError(cleanupException, "Failed to remove an unreferenced uploaded image at {FilePath}.", filePath);
            }
            catch (UnauthorizedAccessException cleanupException)
            {
                logger.LogError(cleanupException, "Failed to remove an unreferenced uploaded image at {FilePath}.", filePath);
            }

            logger.LogError(exception, "Failed to save product image metadata for {ImageKey}.", image);
            throw;
        }

        return Ok(ToDto(productImage));
    }

    private static async Task<bool> HasSupportedImageSignatureAsync(
        IFormFile file,
        string extension,
        CancellationToken cancellationToken)
    {
        if (extension is not ".png" and not ".jpg" and not ".jpeg" and not ".webp")
        {
            return false;
        }

        var header = new byte[12];
        var bytesRead = 0;
        await using var stream = file.OpenReadStream();
        while (bytesRead < header.Length)
        {
            var read = await stream.ReadAsync(header.AsMemory(bytesRead), cancellationToken);
            if (read == 0)
            {
                break;
            }

            bytesRead += read;
        }

        return extension switch
        {
            ".png" => bytesRead >= PngSignature.Length
                && header.AsSpan(0, PngSignature.Length).SequenceEqual(PngSignature),
            ".jpg" or ".jpeg" => bytesRead >= 3
                && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".webp" => bytesRead >= 12
                && header.AsSpan(0, 4).SequenceEqual("RIFF"u8)
                && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
            _ => false
        };
    }

    private static ProductImageDto ToDto(ProductImage image) => new(
        image.Id,
        image.Image,
        image.Thickness,
        image.SizeLabel,
        image.ImageUrl,
        image.SortOrder,
        image.IsActive,
        image.CreatedAtUtc);
}
