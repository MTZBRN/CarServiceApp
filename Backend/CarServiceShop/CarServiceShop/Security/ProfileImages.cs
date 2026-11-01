using SkiaSharp;

namespace CarServiceShop.Security;

public sealed class ProfileImages(IConfiguration configuration, IWebHostEnvironment environment)
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public const int MaxStoredBytes = 16 * 1024 * 1024;
    public const long StorageBytes = 256L * 1024 * 1024;
    public string DirectoryPath { get; } = Path.GetFullPath(configuration["Uploads:Path"] ?? Path.Combine(environment.ContentRootPath, "uploads"));
    private readonly SemaphoreSlim gate = new(1, 1);
    public async Task<IDisposable?> LockAsync(CancellationToken cancellationToken=default)
    {
        if (!await gate.WaitAsync(0,cancellationToken)) return null;
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

    public bool HasRoom(int id, string? previous, int incomingBytes)
    {
        if(incomingBytes>MaxStoredBytes) return false;
        if(!Directory.Exists(DirectoryPath)) return true;
        long bytes=0;var seen=0;
        foreach(var file in new DirectoryInfo(DirectoryPath).EnumerateFiles("profile_*",SearchOption.TopDirectoryOnly)) {
            if(++seen>1024) return false;
            if(!System.Text.RegularExpressions.Regex.IsMatch(file.Name,@"^profile_\d+_[a-zA-Z0-9]+\.(png|jpg|jpeg)$")) continue;
            if((file.Attributes & FileAttributes.ReparsePoint)!=0) return false;
            if(file.Name==previous && System.Text.RegularExpressions.Regex.IsMatch(file.Name,$@"^profile_{id}_[a-zA-Z0-9]+\.(png|jpg|jpeg)$")) continue;
            bytes+=file.Length;if(bytes+incomingBytes>StorageBytes)return false;
        }
        return bytes+incomingBytes<=StorageBytes;
    }

    public bool TryDeleteOwned(int id, string? name)
    {
        try { DeleteOwned(id,name);return true; }
        catch(Exception error) when(error is IOException or UnauthorizedAccessException) { return false; }
    }
}
