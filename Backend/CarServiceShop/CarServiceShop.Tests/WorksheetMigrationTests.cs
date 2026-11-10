using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace CarServiceShop.Tests;

public class WorksheetMigrationTests
{
    private static ApplicationDbContext Context(SqliteConnection connection) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);

    private static List<object[]> Rows(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        var rows = new List<object[]>();
        while (reader.Read())
        {
            var row = new object[reader.FieldCount];
            reader.GetValues(row);
            rows.Add(row);
        }
        return rows;
    }

    private static void VerifyIntegrity(SqliteConnection connection)
    {
        Assert.Equal("ok", Assert.Single(Rows(connection, "PRAGMA integrity_check"))[0]);
        Assert.Empty(Rows(connection, "PRAGMA foreign_key_check"));
    }

    [Fact]
    public async Task PopulatedBackupPreservesEveryOriginalBusinessValueAndRelationship()
    {
        using var source = new SqliteConnection("Data Source=:memory:");
        using var copy = new SqliteConnection("Data Source=:memory:");
        source.Open();
        copy.Open();
        await using var original = Context(source);
        await original.GetService<IMigrator>().MigrateAsync("20261109094536_AddWorkshopSessions");
        await original.Database.ExecuteSqlRawAsync("""
            INSERT INTO Customers (Id,Name,PhoneNumber) VALUES (11,'Synthetic owner','555');
            INSERT INTO Vehicles (Id,LicensePlate,Make,Model,Year,CustomerId) VALUES (22,'FIXTURE','Example','One',2021,11);
            INSERT INTO Appointments (Id,VehicleId,Note,StartTime,EndTime) VALUES (33,22,'Fixture','2026-01-01','2026-01-02');
            INSERT INTO ServiceJobs (Id,VehicleId,AppointmentId,Date,Description,IsCompleted,LaborCost) VALUES
                (41,22,33,'2026-01-01','Completed',1,7777),(42,22,NULL,'2026-01-02','Unknown',0,9876),
                (43,22,NULL,'2026-01-03','Audited draft',0,1234),(44,22,NULL,'2026-01-04','Reopened',0,8811);
            INSERT INTO Parts (Id,Name,PartNumber,NetPrice,GrossPrice,StockQuantity) VALUES (55,'Part','FX',100,127,8);
            INSERT INTO JobParts (Id,ServiceJobId,PartName,PartNumber,Quantity,UnitPrice) VALUES (66,41,'Part','FX',3,117);
            INSERT INTO GlobalSettings (Id,CompanyName,Address,Phone,Email,TaxNumber,HourlyRate,VatRate)
                VALUES (1,'Fixture settings','Road','123','','',8000,27);
            """);
        foreach (var id in new[] { 43, 44 })
            original.AuditEvents.Add(original.Audit.Create("Worksheet.Created", "Worksheet", id,
                """{"changes":{"IsCompleted":{"before":null,"after":false}}}"""));
        original.AuditEvents.Add(original.Audit.Create("Worksheet.Reopened", "Worksheet", 44));
        await original.SaveChangesAsync();
        VerifyIntegrity(source);
        source.BackupDatabase(copy);
        VerifyIntegrity(copy);

        await using var migrated = Context(copy);
        await migrated.Database.MigrateAsync();
        VerifyIntegrity(copy);
        // Compare all pre-existing columns, ordered by primary key, including IDs and foreign keys.
        foreach (var table in new[] { "Customers", "Vehicles", "Appointments", "ServiceJobs", "Parts", "JobParts", "GlobalSettings", "AuditEvents" })
        {
            var columns = Rows(source, $"PRAGMA table_info({table})").Select(row => (string)row[1]);
            var query = $"SELECT {string.Join(",", columns)} FROM {table} ORDER BY Id";
            var before = Rows(source, query);
            var after = Rows(copy, query);
            Assert.NotEmpty(before);
            Assert.Equal(before.Count, after.Count);
            Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(after));
        }
        var jobs = await migrated.ServiceJobs.AsNoTracking().OrderBy(j => j.Id).ToListAsync();
        Assert.All(jobs, job => { Assert.Null(job.CompanySnapshot); Assert.Null(job.OdometerKm); Assert.Null(job.PowertrainCode); });
        Assert.Equal(new[] { CompanyHistory.HistoricalUnavailable, CompanyHistory.HistoricalUnavailable,
            CompanyHistory.Pending, CompanyHistory.HistoricalUnavailable }, jobs.Select(j => j.CompanyHistory));
        await Assert.ThrowsAsync<SqliteException>(() => migrated.Database.ExecuteSqlRawAsync(
            "UPDATE ServiceJobs SET CompanyHistory = 'Pending', IsCompleted = 0 WHERE Id = 41"));
        var valid = JsonSerializer.Serialize(new CompanySnapshot("Fixture", "", "", "", "", "v1",
            new DateTime(2026, 1, 5, 12, 30, 0, DateTimeKind.Utc).AddTicks(1234567)));
        async Task Capture(int id, int completed, string? json) =>
            await migrated.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE ServiceJobs SET CompanyHistory='Captured', CompanySnapshot={json}, IsCompleted={completed} WHERE Id={id}");

        foreach (var invalid in new string?[] { null, "null", "{", "[]", "{}", valid.Replace("\"Phone\":\"\"", "\"Phone\":12"),
            valid.Replace("2026-01-05", "2026-02-31"), valid.Replace(".1234567Z", "+01:00"),
            valid.Replace("CapturedAtUtc", "OtherDate"), valid.Replace("SettingsVersion", "Phone") })
        {
            var error = await Assert.ThrowsAsync<SqliteException>(() => Capture(43, 1, invalid));
            Assert.Equal(1811, error.SqliteExtendedErrorCode); // SQLITE_CONSTRAINT_TRIGGER
        }
        async Task Insert(int completed, string json) =>
            await migrated.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO ServiceJobs (VehicleId, Date, Description, IsCompleted, LaborCost, CompanyHistory, CompanySnapshot)
                VALUES (22, '2026-01-05', 'Direct capture', {completed}, 0, 'Captured', {json})
                """);
        await Assert.ThrowsAsync<SqliteException>(() => Insert(0, valid));
        var malformedInsert = await Assert.ThrowsAsync<SqliteException>(() => Insert(1, "{"));
        Assert.Equal(1811, malformedInsert.SqliteExtendedErrorCode);
        await Assert.ThrowsAsync<SqliteException>(() => Capture(43, 0, valid));
        await Assert.ThrowsAsync<SqliteException>(() => Capture(41, 1, valid));
        await Capture(43, 1, valid);
        await migrated.Database.ExecuteSqlRawAsync("UPDATE ServiceJobs SET IsCompleted=0 WHERE Id=43");
        await Assert.ThrowsAsync<SqliteException>(() => Capture(43, 1, null));
        await Assert.ThrowsAsync<SqliteException>(() => Capture(43, 1, valid.Replace("Fixture", "Changed")));
        Assert.Equal(valid, Rows(copy, "SELECT CompanySnapshot FROM ServiceJobs WHERE Id=43").Single()[0]);
        VerifyIntegrity(copy);
        Assert.False(migrated.Database.HasPendingModelChanges());
    }
}
