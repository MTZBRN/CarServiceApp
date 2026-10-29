using CarServiceShop.Security;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Data;

// Local operator command only. Never called during ordinary startup or from an HTTP endpoint.
public static class TestAdminRecovery
{
    public static void Recover(ApplicationDbContext db, string email, string password)
    {
        if (!SecurityRules.ValidPassword(password)) throw new InvalidOperationException(SecurityRules.PasswordMessage);
        using var transaction = db.Database.BeginTransaction();
        var user = db.Users.SingleOrDefault(u => u.Email == email)
            ?? throw new InvalidOperationException("Account not found; recovery does not create accounts.");
        user.Role = "admin";
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.SessionVersion = Guid.NewGuid().ToString("N");
        db.SaveChanges();
        transaction.Commit();
    }

    public static string ReadPassword(string prompt)
    {
        if (Console.IsInputRedirected) throw new InvalidOperationException("Run recovery in an interactive local terminal.");
        Console.Write(prompt);
        var value = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return value.ToString(); }
            if (key.Key == ConsoleKey.Escape) throw new OperationCanceledException("Recovery cancelled.");
            if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) value.Length--; }
            else if (!char.IsControl(key.KeyChar)) value.Append(key.KeyChar);
        }
    }
}
