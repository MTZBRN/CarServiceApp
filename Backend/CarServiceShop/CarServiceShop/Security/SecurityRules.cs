using System.Text;
using System.Security.Cryptography;

namespace CarServiceShop.Security;

public static class SecurityRules
{
    public static byte[] SigningKey(string? value)
    {
        // Require external random material, never a human-readable sample/passphrase.
        byte[] bytes;
        try { bytes = Convert.FromBase64String(value ?? ""); }
        catch (FormatException) { throw new InvalidOperationException("Jwt:Key must be a random base64 secret of at least 32 bytes."); }
        if (bytes.Length < 32 || bytes.Distinct().Count() < 16 ||
            new[] { "example", "default", "changeme", "secret", "GTA_" }.Any(s => (value ?? "").Contains(s, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Jwt:Key must be a random base64 secret of at least 32 bytes.");
        return bytes;
    }

    public static bool ValidPassword(string? password) => !string.IsNullOrWhiteSpace(password) &&
        password.EnumerateRunes().Count() >= 12 && Encoding.UTF8.GetByteCount(password) <= 72;
    public const string PasswordMessage = "A jelszó legalább 12 karakter és legfeljebb 72 UTF-8 bájt lehet.";
    // Process-local random hash equalizes missing-user verification work without a reusable credential.
    public static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
}
