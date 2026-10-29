using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.Sqlite;
using Xunit.Abstractions;

namespace CarServiceShop.Tests;

public class Stage3BCompatibilityTests(ITestOutputHelper output)
{
    [Fact]
    public async Task LoadedNativeSqliteMeetsPatchedBaseline()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT sqlite_version()";
        var version = (string)(await command.ExecuteScalarAsync())!;
        output.WriteLine("Loaded native SQLite: " + version);
        // CVE-2025-6965 affects SQLite before 3.50.2, independent of the managed provider version.
        Assert.True(Version.Parse(version) >= new Version(3, 50, 2), "Native SQLite is below the patched baseline: " + version);
    }

    [Fact]
    public async Task UpgradedSwaggerGeneratesOnlyInDevelopment()
    {
        using var host = new SecurityHost();
        using var production = host.Client();
        var hidden = await production.GetAsync("/swagger/v1/swagger.json");
        Assert.NotEqual("application/json", hidden.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("\"openapi\"", await hidden.Content.ReadAsStringAsync());

        using var development = host.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = development.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.StartsWith("3.", document.GetProperty("openapi").GetString());
        Assert.True(document.GetProperty("paths").TryGetProperty("/api/Auth/login", out _));
    }
}
