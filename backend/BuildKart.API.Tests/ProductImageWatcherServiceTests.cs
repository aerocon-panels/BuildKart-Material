using BuildKart.API.Services;
using Xunit;

namespace BuildKart.API.Tests;

public sealed class ProductImageWatcherServiceTests
{
    [Fact]
    public void ParseImageFile_UsesNullSizeLabelForMainImage()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var image = ProductImageWatcherService.ParseImageFile(
            root,
            Path.Combine(root, "75mm", "aerocon-75mm.png"));

        Assert.Equal(
            new ProductImageFileMetadata(
                "aerocon-sandwich-partition-panel-75mm",
                "75mm",
                null,
                "/product-images/75mm/aerocon-75mm.png"),
            image);
    }

    [Theory]
    [InlineData("Aerocon_Panel_8x2ft.png", "8ft")]
    [InlineData("Aerocon_Panel_9x2ft.png", "9ft")]
    [InlineData("Aerocon_Panel_10x2ft.png", "10ft")]
    public void ParseImageFile_ExtractsSizeLabelFromFileName(string fileName, string expectedSizeLabel)
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var image = ProductImageWatcherService.ParseImageFile(
            root,
            Path.Combine(root, "75mm", fileName));

        Assert.Equal(expectedSizeLabel, image?.SizeLabel);
        Assert.Equal(
            $"aerocon-sandwich-partition-panel-75mm-{expectedSizeLabel}",
            image?.Image);
    }

    [Fact]
    public void ParseImageFile_IgnoresImageAtRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));

        var image = ProductImageWatcherService.ParseImageFile(
            root,
            Path.Combine(root, "material-1.jpg"));

        Assert.Null(image);
    }

    [Fact]
    public async Task OpenReadWithRetryAsync_RetriesUntilFileIsUnlocked()
    {
        var filePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.png");
        await System.IO.File.WriteAllBytesAsync(filePath, new byte[] { 1, 2, 3 });
        var lockedFile = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.ReadWrite,
            FileShare.None);

        try
        {
            var readTask = ProductImageWatcherService.OpenReadWithRetryAsync(
                filePath,
                maxAttempts: 10,
                retryDelay: TimeSpan.FromMilliseconds(50),
                cancellationToken: CancellationToken.None);

            await Task.Delay(TimeSpan.FromMilliseconds(150));
            lockedFile.Dispose();

            await using var readableFile = await readTask;
            Assert.True(readableFile.CanRead);
        }
        finally
        {
            lockedFile.Dispose();
            System.IO.File.Delete(filePath);
        }
    }
}
