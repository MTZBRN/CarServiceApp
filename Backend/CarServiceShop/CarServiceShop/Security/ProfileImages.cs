using SkiaSharp;

namespace CarServiceShop.Security;

public sealed class ProfileImages(IConfiguration configuration, IWebHostEnvironment environment)
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public string DirectoryPath { get; } = Path.GetFullPath(configuration["Uploads:Path"] ?? Path.Combine(environment.ContentRootPath, "uploads"));
    private readonly SemaphoreSlim gate = new(1, 1);
    public async Task<IDisposable> LockAsync()
    {
        await gate.WaitAsync();
        return new Release(gate);
    }
    private sealed class Release(SemaphoreSlim gate) : IDisposable { public void Dispose() => gate.Release(); }

    public static byte[]? Normalize(byte[] bytes)
    {
        try
        {
            using var data = SKData.CreateCopy(bytes);
            using var codec = SKCodec.Create(data);
            if (codec == null || codec.EncodedFormat is not (SKEncodedImageFormat.Png or SKEncodedImageFormat.Jpeg) ||
                codec.Info.Width < 1 || codec.Info.Height < 1 || codec.Info.Width > 2048 || codec.Info.Height > 2048 || codec.FrameCount > 1) return null;
            using var bitmap = new SKBitmap(new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
            if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success) return null;
            using var image = SKImage.FromBitmap(bitmap);
            using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
            return encoded.ToArray();
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException) { return null; }
    }

    public void DeleteOwned(int id, string? name)
    {
        // Accept only generated basenames (including the old timestamp format), never arbitrary paths.
        if (name == null || !System.Text.RegularExpressions.Regex.IsMatch(name, $@"^profile_{id}_[a-zA-Z0-9]+\.(png|jpg|jpeg)$")) return;
        File.Delete(Path.Combine(DirectoryPath, name));
    }
}
