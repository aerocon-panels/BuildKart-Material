using System.Data.Common;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using BuildKart.API.Data;
using BuildKart.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Services;

public sealed class ProductImageWatcherService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    ILogger<ProductImageWatcherService> logger) : BackgroundService
{
    private const int FileOpenAttempts = 6;
    private static readonly TimeSpan EventDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(1);
    private static readonly Regex ThicknessPattern = new(
        @"^[0-9]+(?:\.[0-9]+)?mm$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex SizePattern = new(
        @"(?<!\d)(?<length>[0-9]+(?:\.[0-9]+)?)\s*x\s*[0-9]+(?:\.[0-9]+)?\s*ft(?=$|[^a-z0-9])",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp"
    };

    private readonly Channel<FileEvent> _fileEvents = Channel.CreateUnbounded<FileEvent>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var imageRootSetting = configuration["ImageRoot"];
        if (string.IsNullOrWhiteSpace(imageRootSetting))
        {
            throw new InvalidOperationException("ImageRoot must be configured in appsettings.json.");
        }

        var imageRoot = Path.GetFullPath(imageRootSetting, environment.ContentRootPath);
        Directory.CreateDirectory(imageRoot);

        FileSystemWatcher? watcher = null;
        try
        {
            watcher = new FileSystemWatcher(imageRoot)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.Size | NotifyFilters.LastWrite
            };
            watcher.Created += OnCreated;
            watcher.Renamed += OnRenamed;
            watcher.Error += OnWatcherError;
            watcher.EnableRaisingEvents = true;

            logger.LogInformation("Watching product image directory {ImageRoot}.", imageRoot);
            QueueExistingImages(imageRoot);

            await foreach (var fileEvent in _fileEvents.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    if (fileEvent.DelayBeforeProcessing)
                    {
                        await Task.Delay(EventDelay, stoppingToken);
                    }

                    var image = ParseImageFile(imageRoot, fileEvent.Path);
                    if (image is null)
                    {
                        continue;
                    }

                    await using var fileStream = await OpenReadWithRetryAsync(
                        fileEvent.Path,
                        FileOpenAttempts,
                        RetryDelay,
                        stoppingToken);

                    var firstByte = new byte[1];
                    if (await fileStream.ReadAsync(firstByte.AsMemory(), stoppingToken) == 0)
                    {
                        throw new IOException($"Image file '{fileEvent.Path}' is empty.");
                    }

                    await UpsertImageAsync(image, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception) when (
                    exception is IOException
                        or UnauthorizedAccessException
                        or DbUpdateException
                        or DbException
                        or InvalidOperationException
                        or ArgumentException
                        or NotSupportedException
                        or TimeoutException)
                {
                    logger.LogError(exception, "Failed to synchronize product image file {FilePath}; watching will continue.", fileEvent.Path);
                }
            }
        }
        finally
        {
            _fileEvents.Writer.TryComplete();
            if (watcher is not null)
            {
                watcher.EnableRaisingEvents = false;
                watcher.Dispose();
                logger.LogInformation("Stopped watching product image directory {ImageRoot}.", imageRoot);
            }
        }
    }

    internal static ProductImageFileMetadata? ParseImageFile(string imageRoot, string filePath)
    {
        if (!ImageExtensions.Contains(Path.GetExtension(filePath)))
        {
            return null;
        }

        var root = Path.GetFullPath(imageRoot);
        var fullPath = Path.GetFullPath(filePath);
        var relativePath = Path.GetRelativePath(root, fullPath);
        if (Path.IsPathRooted(relativePath)
            || relativePath == "."
            || relativePath == ".."
            || relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
            || relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}", StringComparison.Ordinal))
        {
            return null;
        }

        var pathParts = relativePath.Split(
            [Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar],
            StringSplitOptions.RemoveEmptyEntries);
        if (pathParts.Length != 2)
        {
            return null;
        }

        var thickness = pathParts[0];
        var fileName = pathParts[1];
        if (!ThicknessPattern.IsMatch(thickness))
        {
            return null;
        }

        var sizeLabel = GetSizeLabelFromFileName(fileName);
        var imageKey = $"aerocon-sandwich-partition-panel-{thickness}";
        if (sizeLabel is not null)
        {
            imageKey = $"{imageKey}-{sizeLabel}";
        }

        return new ProductImageFileMetadata(
            imageKey,
            thickness,
            sizeLabel,
            $"/product-images/{thickness}/{fileName}");
    }

    internal static string? GetSizeLabelFromFileName(string fileName)
    {
        var nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
        var match = SizePattern.Match(nameWithoutExtension);
        return match.Success ? $"{match.Groups["length"].Value}ft" : null;
    }

    internal static async Task<FileStream> OpenReadWithRetryAsync(
        string filePath,
        int maxAttempts,
        TimeSpan retryDelay,
        CancellationToken cancellationToken)
    {
        if (maxAttempts < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(maxAttempts));
        }

        IOException? lastException = null;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                return new FileStream(
                    filePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.None,
                    bufferSize: 1,
                    useAsync: true);
            }
            catch (IOException exception)
            {
                lastException = exception;
                if (attempt < maxAttempts)
                {
                    await Task.Delay(retryDelay, cancellationToken);
                }
            }
        }

        throw new IOException($"Could not read image file '{filePath}' after {maxAttempts} attempts.", lastException);
    }

    private void OnCreated(object sender, FileSystemEventArgs eventArgs) =>
        QueueImageFile(eventArgs.FullPath, delayBeforeProcessing: true);

    private void OnRenamed(object sender, RenamedEventArgs eventArgs) =>
        QueueImageFile(eventArgs.FullPath, delayBeforeProcessing: true);

    private void OnWatcherError(object sender, ErrorEventArgs eventArgs) =>
        logger.LogError(eventArgs.GetException(), "The product image file watcher reported an error.");

    private void QueueImageFile(string filePath, bool delayBeforeProcessing)
    {
        if (ImageExtensions.Contains(Path.GetExtension(filePath)))
        {
            _fileEvents.Writer.TryWrite(new FileEvent(filePath, delayBeforeProcessing));
        }
    }

    private void QueueExistingImages(string imageRoot)
    {
        try
        {
            foreach (var thicknessDirectory in Directory.EnumerateDirectories(
                         imageRoot,
                         "*",
                         SearchOption.TopDirectoryOnly))
            {
                try
                {
                    foreach (var filePath in Directory.EnumerateFiles(
                                 thicknessDirectory,
                                 "*",
                                 SearchOption.TopDirectoryOnly))
                    {
                        QueueImageFile(filePath, delayBeforeProcessing: false);
                    }
                }
                catch (Exception exception) when (
                    exception is IOException or UnauthorizedAccessException)
                {
                    logger.LogError(exception, "Failed to scan product image subfolder {Directory}.", thicknessDirectory);
                }
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogError(exception, "Failed to scan product image directory {ImageRoot}.", imageRoot);
        }
    }

    private async Task UpsertImageAsync(
        ProductImageFileMetadata image,
        CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BuildKartDbContext>();
        var imageAtPath = await dbContext.ProductImages.FirstOrDefaultAsync(
            item => item.ImageUrl == image.ImageUrl,
            cancellationToken);
        if (imageAtPath is not null)
        {
            imageAtPath.SortOrder = 1;
            imageAtPath.IsActive = true;
            imageAtPath.CreatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Confirmed uploaded product image {ImageKey} ({Thickness}, {SizeLabel}) at {ImageUrl}.",
                imageAtPath.Image,
                imageAtPath.Thickness,
                imageAtPath.SizeLabel,
                image.ImageUrl);
            return;
        }

        var existingImage = await dbContext.ProductImages.FirstOrDefaultAsync(
            item => item.Image == image.Image
                && item.Thickness == image.Thickness
                && item.SizeLabel == image.SizeLabel,
            cancellationToken);

        if (existingImage is null)
        {
            dbContext.ProductImages.Add(new ProductImage
            {
                Image = image.Image,
                Thickness = image.Thickness,
                SizeLabel = image.SizeLabel,
                ImageUrl = image.ImageUrl,
                SortOrder = 1,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            existingImage.ImageUrl = image.ImageUrl;
            existingImage.SortOrder = 1;
            existingImage.IsActive = true;
            existingImage.CreatedAtUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Synchronized product image {ImageKey} ({Thickness}, {SizeLabel}) to {ImageUrl}.",
            image.Image,
            image.Thickness,
            image.SizeLabel,
            image.ImageUrl);
    }

    private sealed record FileEvent(string Path, bool DelayBeforeProcessing);
}

internal sealed record ProductImageFileMetadata(
    string Image,
    string Thickness,
    string? SizeLabel,
    string ImageUrl);
