using System.Data.Common;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace CarServiceShop.Tests;

public class ActivityLimitTests
{
    private sealed class Clock : TimeProvider
    {
        private readonly DateTimeOffset start = DateTimeOffset.UtcNow;
        public int Minute { get; set; }
        public override DateTimeOffset GetUtcNow() => start.AddMinutes(Minute);
    }

    // Pause before SQLite takes its write lock, while the HTTP limiter permit is held.
    private sealed class TransactionGate(IHttpContextAccessor accessor) : DbTransactionInterceptor
    {
        public bool Hold { get; set; }
        public System.Threading.Channels.Channel<bool> Entered { get; } =
            System.Threading.Channels.Channel.CreateUnbounded<bool>();
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
            DbConnection connection, TransactionStartingEventData eventData,
            InterceptionResult<DbTransaction> result, CancellationToken cancellationToken = default)
        {
            if (Hold && accessor.HttpContext?.Request.Path == "/api/Auth/activity") {
                Entered.Writer.TryWrite(true);
                await Release.Task.WaitAsync(cancellationToken);
            }
            return result;
        }
    }

    private static async Task Login(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/Auth/login", new {email, password="Synthetic-password-123"});
        response.EnsureSuccessStatusCode();
        var data = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", data.GetProperty("token").GetString());
    }

    [Fact]
    public async Task RateBudgetIsSharedAcrossLoginsAndRejectionDoesNotTouchDeadline()
    {
        using var host = new SecurityHost();
        host.AddUser();
        var clock = new Clock();
        using var configured = host.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));
        using var client = configured.CreateClient();
        using var second = configured.CreateClient();
        await Login(client, "owner");
        await Login(second, "owner");
        var rejected = false;
        // Normal requests are sequential here, so 429 must come from the rate budget.
        for (var attempt=0; attempt<100; attempt++) {
            var response = await client.PostAsync("/api/Auth/activity", null);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) { rejected=true; break; }
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        Assert.True(rejected);
        clock.Minute=10;
        Assert.Equal(HttpStatusCode.TooManyRequests, (await second.PostAsync("/api/Auth/activity", null)).StatusCode);
        using (var scope=configured.Services.CreateScope()) {
            var deadlines=await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Sessions.Select(s=>s.IdleUntil).ToListAsync();
            Assert.All(deadlines, until=>Assert.True(until <= clock.GetUtcNow().AddMinutes(5).ToUnixTimeMilliseconds()));
        }
        clock.Minute=15;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await second.PostAsync("/api/Auth/activity", null)).StatusCode);
    }

    [Fact]
    public async Task ConcurrencyBoundsApplyBeforeTransactionsWhileOtherBusinessWorkSucceeds()
    {
        using var host = new SecurityHost();
        host.AddUser("one"); host.AddUser("two", role:"mechanic"); host.AddUser("three", role:"mechanic");
        using var configured = host.WithWebHostBuilder(b => b.ConfigureServices(s => {
            s.AddSingleton<TransactionGate>();
            s.ConfigureDbContext<ApplicationDbContext>((provider, options) => options.AddInterceptors(provider.GetRequiredService<TransactionGate>()));
        }));
        using var one=configured.CreateClient(); using var two=configured.CreateClient(); using var three=configured.CreateClient();
        await Login(one,"one"); await Login(two,"two"); await Login(three,"three");
        int jobId;
        using (var scope=configured.Services.CreateScope()) {
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var job=new ServiceJob {Vehicle=new Vehicle {Customer=new Customer {Name="Fictional owner",PhoneNumber="123"},
                LicensePlate="FAKE-123",Make="Test",Model="Test",Year=2020},Description="Original"};
            db.ServiceJobs.Add(job); await db.SaveChangesAsync(); jobId=job.Id;
        }
        var gate=configured.Services.GetRequiredService<TransactionGate>();
        gate.Hold=true;
        var first=one.PostAsync("/api/Auth/activity",null);
        try {
            await gate.Entered.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal(HttpStatusCode.TooManyRequests,(await one.PostAsync("/api/Auth/activity",null)).StatusCode);
            var second=two.PostAsync("/api/Auth/activity",null);
            try {
                await gate.Entered.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
                Assert.Equal(HttpStatusCode.TooManyRequests,(await three.PostAsync("/api/Auth/activity",null)).StatusCode);
                Assert.Equal(HttpStatusCode.OK,(await three.GetAsync("/api/Customers").WaitAsync(TimeSpan.FromSeconds(5))).StatusCode);
                var worksheet=await three.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/"+jobId);
                var saved=await three.PutAsJsonAsync("/api/ServiceJobs/"+jobId,new {
                    version=worksheet.GetProperty("version").GetString(), description="Fictional saved edit",laborCost=0,isCompleted=false,jobParts=Array.Empty<object>()
                }).WaitAsync(TimeSpan.FromSeconds(5));
                Assert.Equal(HttpStatusCode.OK,saved.StatusCode);
            } finally { gate.Release.TrySetResult(); await second; }
        } finally { gate.Release.TrySetResult(); await first; }
    }
}
