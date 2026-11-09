using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Hosting;
using CarServiceShop.Data;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Tests;

public class IdleSessionTests
{
    private sealed class Clock : TimeProvider
    {
        private readonly DateTimeOffset start = DateTimeOffset.UtcNow;
        public int Minute { get; set; }
        public override DateTimeOffset GetUtcNow() => start.AddMinutes(Minute);
    }

    private static async Task Login(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/Auth/login", new { email = "owner", password = "Synthetic-password-123" });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
    }

    [Fact]
    public async Task OnlyActivityExtendsItsOwnSessionAcrossHosts()
    {
        using var host = new SecurityHost();
        host.AddUser();
        var clock = new Clock();
        void Configure(IWebHostBuilder builder) => builder.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock));
        using var first = host.WithWebHostBuilder(Configure);
        using var active = first.CreateClient();
        using var idle = first.CreateClient();
        await Login(active);
        await Login(idle);
        using var locked = first.CreateClient();
        await Login(locked);
        Assert.Equal(HttpStatusCode.NoContent, (await locked.PostAsync("/api/Auth/logout?currentSessionOnly=true", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await locked.GetAsync("/api/Auth/me")).StatusCode);

        clock.Minute = 10;
        var concurrent = await Task.WhenAll(active.PostAsync("/api/Auth/activity", null), active.PostAsync("/api/Auth/activity", null));
        Assert.Contains(concurrent, r => r.StatusCode == HttpStatusCode.OK);
        Assert.All(concurrent, r => Assert.Contains(r.StatusCode, new[] {HttpStatusCode.OK, HttpStatusCode.TooManyRequests}));
        clock.Minute = 14;
        Assert.Equal(HttpStatusCode.OK, (await idle.GetAsync("/api/Auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await idle.GetAsync("/api/Customers")).StatusCode);
        clock.Minute = 15;
        Assert.Equal(HttpStatusCode.Unauthorized, (await idle.PostAsync("/api/Auth/activity", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await idle.GetAsync("/api/Customers")).StatusCode);

        using var restarted = host.WithWebHostBuilder(Configure);
        using var replay = restarted.CreateClient();
        replay.DefaultRequestHeaders.Authorization = active.DefaultRequestHeaders.Authorization;
        clock.Minute = 24;
        Assert.Equal(HttpStatusCode.OK, (await replay.GetAsync("/api/Customers")).StatusCode);
        clock.Minute = 25;
        Assert.Equal(HttpStatusCode.Unauthorized, (await replay.GetAsync("/api/Customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await active.PostAsync("/api/Auth/activity", null)).StatusCode);
    }

    [Fact]
    public async Task ContinuousActivityCannotExtendPastEightHours()
    {
        using var host = new SecurityHost();
        host.AddUser();
        var clock = new Clock();
        using var configured = host.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));
        using var client = configured.CreateClient();
        await Login(client);
        // Simulate previous acknowledged activity close to the absolute boundary.
        // Advancing the session clock does not advance the independent rate limiter clock.
        using (var scope=configured.Services.CreateScope()) {
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Sessions.ExecuteUpdateAsync(update=>update.SetProperty(s=>s.IdleUntil,s=>s.AbsoluteUntil));
        }
        clock.Minute=479;
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/Auth/activity", null)).StatusCode);
        clock.Minute=480;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Customers")).StatusCode);
    }
}
