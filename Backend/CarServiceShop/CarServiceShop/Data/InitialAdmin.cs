using CarServiceShop.Models;
using CarServiceShop.Security;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Data;

public static class InitialAdmin
{
    // Explicit CLI only. Never invoked by normal web startup. Existing accounts are never changed.
    public static void Provision(ApplicationDbContext db, IConfiguration config)
    {
        using var transaction = db.Database.BeginTransaction();
        if (db.Users.Any()) return;
        var email = config["InitialAdmin:Email"];
        var password = config["InitialAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 || !SecurityRules.ValidPassword(password))
            throw new InvalidOperationException("InitialAdmin requires an email and a password of 12 characters / at most 72 UTF-8 bytes.");
        var user=new User { Name = "Administrator", Email = email.Trim(), Role = "admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) };
        db.Users.Add(user);
        db.SaveChanges();
        db.Audit.Append(db,db.Audit.Create("Auth.InitialAdminProvisioned","User",user.Id,"{\"role\":\"admin\"}",system:true));
        transaction.Commit();
    }
}
