using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CarServiceShop.Tests;

public class WorksheetPersistenceTests
{
    private static void AddVehicle(SecurityHost host)
    {
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Vehicles.Add(new Vehicle { LicensePlate = "FIXTURE", Customer = new Customer { Name = "Fixture" } });
        db.SaveChanges();
    }

    private static async Task<JsonElement> Body(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task VisitValuesDistinguishMissingFromExplicitNull()
    {
        using var host = new SecurityHost();
        using var client = await host.SignedIn();
        AddVehicle(host);
        var job = await Body(await client.PostAsJsonAsync("/api/ServiceJobs",
            new { vehicleId = 1, description = "Fixture", odometerKm = 0, powertrainCode = "cng" }));
        var route = "/api/ServiceJobs/" + job.GetProperty("id");
        var blocked = await client.PutAsJsonAsync(route, new { version = job.GetProperty("version"), description = "Incomplete", isCompleted = true });
        Assert.Equal(HttpStatusCode.BadRequest, blocked.StatusCode);
        Assert.Contains("cégadatokat", await blocked.Content.ReadAsStringAsync());
        var unchanged = await client.GetFromJsonAsync<JsonElement>(route);
        Assert.False(unchanged.GetProperty("isCompleted").GetBoolean());
        Assert.Equal("Pending", unchanged.GetProperty("companyHistory").GetString());
        Assert.Equal(JsonValueKind.Null, unchanged.GetProperty("companySnapshot").ValueKind);
        Assert.Equal(job.GetProperty("version").GetString(), unchanged.GetProperty("version").GetString());
        job = await Body(await client.PutAsJsonAsync(route, new { version = job.GetProperty("version"), description = "Older client" }));
        Assert.Equal(0, job.GetProperty("odometerKm").GetInt32());
        Assert.Equal("cng", job.GetProperty("powertrainCode").GetString());
        foreach (var code in new[] { "petrol", "diesel", "hybrid", "electric", "lpg", "cng", "other" })
        {
            job = await Body(await client.PutAsJsonAsync(route, new { version = job.GetProperty("version"), description = "Visit", powertrainCode = code, odometerKm = 123456 }));
            Assert.Equal(code, job.GetProperty("powertrainCode").GetString());
            Assert.Equal(123456, job.GetProperty("odometerKm").GetInt32());
        }
        foreach (var invalid in new object[] { new { odometerKm = -1 }, new { odometerKm = 1.5 }, new { odometerKm = 2147483648L }, new { powertrainCode = "unknown" } })
        {
            var fields = JsonSerializer.SerializeToNode(invalid)!.AsObject();
            fields["description"] = "Invalid";
            fields["version"] = job.GetProperty("version").GetString();
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(route, fields)).StatusCode);
        }
        await Body(await client.PutAsJsonAsync(route, new { version = job.GetProperty("version"), description = "Clear", odometerKm = (int?)null, powertrainCode = (string?)null }));
        job = await client.GetFromJsonAsync<JsonElement>(route);
        Assert.Equal(JsonValueKind.Null, job.GetProperty("odometerKm").ValueKind);
        Assert.Equal(JsonValueKind.Null, job.GetProperty("powertrainCode").ValueKind);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task FirstCompletionOwnsTheSnapshot(bool completeOnCreate)
    {
        using var host = new SecurityHost();
        using var client = await host.SignedIn();
        AddVehicle(host);
        var payload = new { vehicleId = 1, description = "Fixture", isCompleted = true,
            companyHistory = "Captured", companySnapshot = new { companyName = "Injected" } };
        var missing = await client.PostAsJsonAsync("/api/ServiceJobs", payload);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("cégadatokat", await missing.Content.ReadAsStringAsync());

        var settings = await Body(await client.PostAsJsonAsync("/api/Settings", new { companyName = "Fixture A", address = "Road A", phone = "123", email = "a@example.invalid", taxNumber = "fixture-tax" }));
        JsonElement job;
        if (completeOnCreate)
            job = await Body(await client.PostAsJsonAsync("/api/ServiceJobs", payload));
        else
        {
            job = await Body(await client.PostAsJsonAsync("/api/ServiceJobs", new { vehicleId = 1, description = "Draft", payload.companySnapshot }));
            Assert.Equal(JsonValueKind.Null, job.GetProperty("companySnapshot").ValueKind);
            var request = new { version = job.GetProperty("version"), description = "Complete", isCompleted = true, payload.companySnapshot };
            var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PutAsJsonAsync("/api/ServiceJobs/1", request)));
            Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
            job = await Body(Assert.Single(results, r => r.IsSuccessStatusCode));
        }
        var snapshot = job.GetProperty("companySnapshot");
        foreach (var field in new[] { "companyName", "address", "phone", "email", "taxNumber" })
            Assert.Equal(settings.GetProperty(field).GetString(), snapshot.GetProperty(field).GetString());
        Assert.Equal(settings.GetProperty("version").GetString(), snapshot.GetProperty("settingsVersion").GetString());
        Assert.Equal(DateTimeKind.Utc, snapshot.GetProperty("capturedAtUtc").GetDateTime().Kind);
        await Body(await client.PostAsJsonAsync("/api/Settings", new { version = settings.GetProperty("version"), companyName = "Fixture B" }));
        foreach (var completed in new[] { true, false, true })
        {
            job = await Body(await client.PutAsJsonAsync("/api/ServiceJobs/1", new { version = job.GetProperty("version"), description = "Edit", isCompleted = completed, payload.companySnapshot }));
            Assert.Equal("Captured", job.GetProperty("companyHistory").GetString());
            Assert.Equal(snapshot.GetRawText(), job.GetProperty("companySnapshot").GetRawText());
        }
        var next = await Body(await client.PostAsJsonAsync("/api/ServiceJobs", payload));
        Assert.Equal("Fixture B", next.GetProperty("companySnapshot").GetProperty("companyName").GetString());
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var failure = await Assert.ThrowsAsync<SqliteException>(() =>
            db.Database.ExecuteSqlRawAsync("UPDATE ServiceJobs SET CompanySnapshot = 'changed' WHERE Id = 1"));
        Assert.Contains("immutable", failure.Message);
    }
}
