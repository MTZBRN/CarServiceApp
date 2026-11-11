using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Tests;

// All fixtures use SecurityHost's disposable database, random signing key and upload directory.
public class GdprPrivacyTests
{
    [Theory]
    [InlineData("/api/Customers/1")]
    [InlineData("/api/Vehicle/1")]
    [InlineData("/api/ServiceJobs/1")]
    [InlineData("/api/ServiceJobs/ByVehicle/1")]
    [InlineData("/api/ServiceJobs/ByAppointment/1")]
    [InlineData("/api/Appointments/1")]
    [InlineData("/api/Audit")]
    [InlineData("/api/Users")]
    public async Task AnonymousPersonalDataReadsAreDeniedAndNotCacheable(string route)
    {
        using var host = new SecurityHost();
        using var client = host.Client();
        using var response = await client.GetAsync(route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    private static async Task<string> Upload(HttpClient client)
    {
        using var form = new MultipartFormDataContent();
        var image = new ByteArrayContent(SecurityIntegrationTests.Picture());
        image.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(image, "file", "fictional-avatar.png");
        using var response = await client.PostAsync("/api/Auth/upload-profile-picture", form);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("filePath").GetString()!;
    }

    [Fact]
    public async Task UploadedStaffPhotoMustNotBeAvailableAnonymouslyAfterLogout()
    {
        using var host = new SecurityHost();
        using var owner = await host.SignedIn();
        var path = await Upload(owner);
        (await owner.PostAsync("/api/Auth/logout", null)).EnsureSuccessStatusCode();
        using var anonymous = host.Client();
        using var response = await anonymous.GetAsync(path);
        // GAP-01: legacy URLs must enforce the same session checks as the API.
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"Private staff image returned {(int)response.StatusCode} to an anonymous client after logout.");
    }

    [Fact]
    public async Task UploadedStaffPhotoMustHaveNoStoreCachePolicy()
    {
        using var host = new SecurityHost();
        using var owner = await host.SignedIn();
        var path = await Upload(owner);
        using var response = await owner.GetAsync(path);
        response.EnsureSuccessStatusCode();
        // GAP-01: caches must not preserve an image after authorization/revocation changes.
        Assert.True(response.Headers.CacheControl?.NoStore == true, "Staff image lacks Cache-Control: no-store.");
    }

    private static async Task<HttpClient> Mechanic(SecurityHost host, string login)
    {
        host.AddUser(login, role: "mechanic");
        var client = host.Client();
        using var response = await client.PostAsJsonAsync("/api/Auth/login", new { email = login, password = "Synthetic-password-123" });
        response.EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString());
        return client;
    }

    [Theory]
    [InlineData("/uploads/", "GET")]
    [InlineData("/uploads/", "HEAD")]
    [InlineData("/api/ProfileImages/", "GET")]
    [InlineData("/api/ProfileImages/", "HEAD")]
    public async Task ImageReadsRequireCurrentOwnerOrAdminSession(string prefix, string method)
    {
        using var host = new SecurityHost();
        using var admin = await host.SignedIn();
        using var owner = await Mechanic(host, "fictional-owner");
        using var other = await Mechanic(host, "fictional-other");
        using var anonymous = host.Client();
        var path = prefix + Path.GetFileName(await Upload(owner));
        async Task Check(HttpClient client, HttpStatusCode status) {
            using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));
            Assert.Equal(status, response.StatusCode);
            Assert.True(response.Headers.CacheControl?.NoStore);
            Assert.Null(response.Headers.ETag);
            if (status == HttpStatusCode.OK) {
                Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
                var bytes = await response.Content.ReadAsByteArrayAsync();
                if (method == "HEAD") Assert.Empty(bytes); else Assert.NotEmpty(bytes);
            }
        }
        await Check(owner, HttpStatusCode.OK);
        await Check(admin, HttpStatusCode.OK);
        await Check(other, HttpStatusCode.NotFound);
        await Check(anonymous, HttpStatusCode.Unauthorized);
        // Query-string tokens must not authenticate image requests.
        using var queryToken = await anonymous.GetAsync(path + "?access_token=" + owner.DefaultRequestHeaders.Authorization!.Parameter);
        Assert.Equal(HttpStatusCode.Unauthorized, queryToken.StatusCode);
        (await owner.PostAsync("/api/Auth/logout", null)).EnsureSuccessStatusCode();
        await Check(owner, HttpStatusCode.Unauthorized);
        using (var scope = host.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Sessions.ExecuteUpdateAsync(s => s.SetProperty(x => x.IdleUntil, 0));
        await Check(admin, HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/uploads/")]
    [InlineData("/api/ProfileImages/")]
    public async Task ImageReadsRejectOrphansReplacementAndWebrootBypasses(string prefix)
    {
        using var host = new SecurityHost();
        using var owner = await host.SignedIn();
        var oldName = Path.GetFileName(await Upload(owner));
        var current = Path.GetFileName(await Upload(owner));
        Assert.False(File.Exists(Path.Combine(host.Root, "uploads", oldName)));
        // Simulate failed cleanup, and a stray deployment copy in public wwwroot.
        File.WriteAllBytes(Path.Combine(host.Root, "uploads", oldName), SecurityIntegrationTests.Picture());
        var shadow = Path.Combine(host.Root, "wwwroot", prefix.Trim('/'));
        Directory.CreateDirectory(shadow);
        File.WriteAllBytes(Path.Combine(shadow, oldName), SecurityIntegrationTests.Picture());
        foreach (var name in new[] { oldName, "profile_1_orphan.png", "old.html", "profile_1_x.png/other", "profile_1_x.png%0A" }) {
            using var denied = await owner.GetAsync(prefix + name);
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            Assert.True(denied.Headers.CacheControl?.NoStore);
        }
        using var anonymous = host.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(prefix + oldName)).StatusCode);
        File.Delete(Path.Combine(host.Root, "uploads", current));
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync(prefix + current)).StatusCode);
    }

    [Theory]
    [InlineData("jpg")]
    [InlineData("jpeg")]
    public async Task CurrentLegacyJpegRemainsReadableOnlyWithAuthorization(string extension)
    {
        using var host = new SecurityHost();
        using var owner = await host.SignedIn();
        var name = "profile_1_20261111." + extension;
        using (var scope = host.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Users.Single().ProfilePicturePath = name;
            db.SaveChanges();
        }
        File.WriteAllBytes(Path.Combine(host.Root, "uploads", name), SecurityIntegrationTests.Picture(SkiaSharp.SKEncodedImageFormat.Jpeg));
        using var response = await owner.GetAsync("/api/ProfileImages/" + name);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task DeletingAccountRevokesItsSessionAndRemovesItsCurrentPhoto()
    {
        using var host = new SecurityHost();
        using var admin = await host.SignedIn();
        host.AddUser("fictional-mechanic", role: "mechanic");
        using var mechanic = host.Client();
        using var login = await mechanic.PostAsJsonAsync("/api/Auth/login", new { email = "fictional-mechanic", password = "Synthetic-password-123" });
        login.EnsureSuccessStatusCode();
        mechanic.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString());
        var path = await Upload(mechanic);
        int id;
        using (var scope = host.Services.CreateScope())
            id = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.Single(u => u.Email == "fictional-mechanic").Id;
        (await admin.DeleteAsync($"/api/Users/{id}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await mechanic.GetAsync("/api/Customers")).StatusCode);
        using var anonymous = host.Client();
        var removed = await anonymous.GetAsync(path);
        Assert.True(removed.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized);
        Assert.False(File.Exists(Path.Combine(host.Root, "uploads", Path.GetFileName(path))));
    }

    [Fact]
    public async Task CustomerDeletionProtectsHistoryAndAuditDoesNotCopyContactValues()
    {
        using var host = new SecurityHost();
        using var admin = await host.SignedIn();
        using var created = await admin.PostAsJsonAsync("/api/Customers", new {
            name = "Fictional Privacy Canary", phoneNumber = "+36 30 555 0199",
            email = "privacy-canary@example.invalid", address = "Fictional Street 42"
        });
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        using (var scope = host.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Vehicles.Add(new Vehicle { CustomerId = id, LicensePlate = "TEST-777", Make = "Fictional", Model = "Fixture", Year = 2020 });
            db.SaveChanges();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/Customers/{id}")).StatusCode);
        using var audit = await admin.GetAsync("/api/Audit");
        audit.EnsureSuccessStatusCode();
        var body = await audit.Content.ReadAsStringAsync();
        foreach (var value in new[] { "Fictional Privacy Canary", "+36 30 555 0199", "privacy-canary@example.invalid", "Fictional Street 42" })
            Assert.DoesNotContain(value, body);
        using var verify = host.Services.CreateScope();
        var context = verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.NotNull(context.Customers.Find(id));
        Assert.DoesNotContain(context.AuditEvents, e => e.Action == "Customer.Deleted" && e.ResourceId == id);
    }
}
