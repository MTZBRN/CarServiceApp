using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Tests;

public class TestAdminRecoveryTests
{
    [Fact]
    public void RecoveryChangesOnlyTargetAccountAndRevokesSessions()
    {
        using var connection = new SqliteConnection("Data Source=:memory:"); connection.Open();
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        db.Database.Migrate();
        db.Users.AddRange(new User { Name="Legacy", Email="legacy", Role="adminisztrátor", PasswordHash="old", SessionVersion="previous" },
            new User { Name="Other", Email="other", Role="mechanic", PasswordHash="unchanged" });
        db.Customers.Add(new Customer { Name="Preserve customer", PhoneNumber="123" }); db.SaveChanges();
        Assert.Throws<InvalidOperationException>(() => TestAdminRecovery.Recover(db,"legacy","short"));
        Assert.Throws<InvalidOperationException>(() => TestAdminRecovery.Recover(db,"missing","Recovery-only-password-123"));
        TestAdminRecovery.Recover(db,"legacy","Recovery-only-password-123");
        db.ChangeTracker.Clear();
        var user = db.Users.Single(u=>u.Email=="legacy");
        Assert.Equal("admin",user.Role); Assert.NotEqual("previous",user.SessionVersion);
        Assert.True(BCrypt.Net.BCrypt.Verify("Recovery-only-password-123",user.PasswordHash));
        Assert.Equal("unchanged",db.Users.Single(u=>u.Email=="other").PasswordHash);
        Assert.Single(db.Customers); Assert.Equal(2,db.Users.Count());
    }
}
