using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;

namespace CarServiceShop.Tests;

public class Stage2BTests
{
    private static async Task<JsonElement> Body(HttpResponseMessage r) { r.EnsureSuccessStatusCode();return await r.Content.ReadFromJsonAsync<JsonElement>(); }
    private static string Version(JsonElement body)=>body.GetProperty("version").GetString()!;
    private static async Task<HttpClient> Mechanic(SecurityHost host) {
        host.AddUser("mechanic",role:"mechanic"); var client=host.Client();
        var body=await Body(await client.PostAsJsonAsync("/api/Auth/login",new{email="mechanic",password="Synthetic-password-123"}));
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",body.GetProperty("token").GetString());return client;
    }
    private static void Records(SecurityHost host) {
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var v=new Vehicle{LicensePlate="ONE",Make="Ford",Model="Focus",Year=2020,Customer=new Customer{Name="Owner",PhoneNumber="123"}};
        db.ServiceJobs.Add(new ServiceJob{Vehicle=v,Description="Original",Appointment=new Appointment{Vehicle=v,StartTime=new DateTime(2026,1,1),EndTime=new DateTime(2026,1,2)},JobParts=[new JobPart{PartName="Original",Quantity=1,UnitPrice=100}]});
        db.Parts.Add(new Part{PartNumber="ONE",Name="Stock",StockQuantity=1});db.GlobalSettings.Add(new GlobalSettings{Id=1,CompanyName="Original"});db.SaveChanges();
    }
    [Fact]
    public async Task ParallelNormalizedUserCreationHasOneWinner_ExistingLoginWorks()
    {
        using var host=new SecurityHost();using var admin=await host.SignedIn();
        var tasks=new[]{"Admin@Test.com","admin@test.com"}.Select(email=>admin.PostAsJsonAsync("/api/Users",new{name="Test",email,password="Synthetic-password-123",role="mechanic"}));
        var results=await Task.WhenAll(tasks);Assert.Single(results,r=>r.StatusCode==HttpStatusCode.OK);Assert.Single(results,r=>r.StatusCode==HttpStatusCode.BadRequest);
        Assert.Equal(HttpStatusCode.BadRequest,(await admin.PostAsJsonAsync("/api/Users",new{name="Test",email="ADMIN@test.com",password="Synthetic-password-123",role="mechanic"})).StatusCode);
        using var client=host.Client();Assert.Equal(HttpStatusCode.OK,(await client.PostAsJsonAsync("/api/Auth/login",new{email=" admin@TEST.com ",password="Synthetic-password-123"})).StatusCode);
        using var scope=host.Services.CreateScope();Assert.Equal(2,scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.Count());
    }
    [Fact]
    public async Task LastAdminSurvivesConcurrentDeletes_DatabaseAlsoEnforcesInvariant()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();host.AddUser("second");
        var responses=await Task.WhenAll(client.DeleteAsync("/api/Users/1"),client.DeleteAsync("/api/Users/2"));
        Assert.Contains(responses,r=>r.IsSuccessStatusCode);
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();Assert.Single(db.Users.Where(u=>u.Role=="admin"));
        var survivor=await db.Users.SingleAsync();db.Users.Remove(survivor);await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());
    }
    [Fact]
    public async Task FinalAdminHttpDeletionFails_MultipleAdminDeletionWorks()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        Assert.Equal(HttpStatusCode.BadRequest,(await client.DeleteAsync("/api/Users/1")).StatusCode);
        host.AddUser("second"); Assert.Equal(HttpStatusCode.OK,(await client.DeleteAsync("/api/Users/2")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.DeleteAsync("/api/Users/1")).StatusCode);
    }
    [Fact]
    public async Task StaleWorksheetCannotReplaceChildren_FreshRetrySucceeds()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        var first=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");var second=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");
        var saved=await Body(await client.PutAsJsonAsync("/api/ServiceJobs/1",new{version=Version(first),description="Winner",laborCost=1,jobParts=new[]{new{partName="Winner",quantity=2,unitPrice=100}}}));
        Assert.NotEqual(Version(first),Version(saved));
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync("/api/ServiceJobs/1",new{version=Version(second),description="Stale",jobParts=new[]{new{partName="Stale",quantity=1,unitPrice=1}}})).StatusCode);
        var current=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");Assert.Equal("Winner",current.GetProperty("jobParts")[0].GetProperty("partName").GetString());
        (await client.PutAsJsonAsync("/api/ServiceJobs/1",new{version=Version(current),description="Retry",jobParts=Array.Empty<object>()})).EnsureSuccessStatusCode();
    }
    [Fact]
    public async Task ParallelWorksheetWritesHaveOneWinnerAndAtomicChildren()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        var current=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");
        var results=await Task.WhenAll(new[]{"First","Second"}.Select(name=>client.PutAsJsonAsync("/api/ServiceJobs/1",new{version=Version(current),description=name,jobParts=new[]{new{partName=name,quantity=1,unitPrice=1}}})));
        Assert.Single(results,r=>r.StatusCode==HttpStatusCode.OK);Assert.Single(results,r=>r.StatusCode==HttpStatusCode.Conflict);
        var saved=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");Assert.Single(saved.GetProperty("jobParts").EnumerateArray());
        Assert.Equal(saved.GetProperty("description").GetString(),saved.GetProperty("jobParts")[0].GetProperty("partName").GetString());
    }
    [Fact]
    public async Task DatabaseGuardsPreventCascadingHistoryDeletion()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(()=>db.Database.ExecuteSqlRawAsync("DELETE FROM Customers WHERE Id=1"));
        await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(()=>db.Database.ExecuteSqlRawAsync("DELETE FROM Vehicles WHERE Id=1"));
        Assert.Single(db.ServiceJobs);Assert.Single(db.JobParts);
    }
    [Theory] [InlineData("Appointments/1")] [InlineData("parts/1")] [InlineData("Settings")]
    public async Task OtherWritesRejectStaleVersions(string route)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        var value=route=="parts/1" ? (await client.GetFromJsonAsync<JsonElement>("/api/parts"))[0] : await client.GetFromJsonAsync<JsonElement>("/api/"+route);var data=JsonSerializer.Deserialize<Dictionary<string,JsonElement>>(value.GetRawText())!;
        // Read responses can contain navigation objects; DTOs continue to ignore them safely.
        var request=new Dictionary<string,object?>();foreach(var pair in data)request[pair.Key]=pair.Value;
        async Task<HttpResponseMessage> Send()=>route=="Settings"?await client.PostAsJsonAsync("/api/Settings",request):await client.PutAsJsonAsync("/api/"+route,request);
        var first=await Body(await Send());Assert.NotEqual(Version(value),Version(first));Assert.Equal(HttpStatusCode.Conflict,(await Send()).StatusCode);
    }
    [Fact]
    public async Task MechanicCanCompleteActiveWork_ButHistoryAndDeletesAreAdminOnly()
    {
        using var host=new SecurityHost();using var admin=await host.SignedIn();using var mechanic=await Mechanic(host);Records(host);
        var active=await Body(await mechanic.PostAsJsonAsync("/api/ServiceJobs",new{vehicleId=1,description="Mechanic work"}));var id=active.GetProperty("id").GetInt32();
        var edited=await Body(await mechanic.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(active),description="Active edit",laborCost=100}));
        (await mechanic.PostAsJsonAsync("/api/JobParts",new{serviceJobId=id,version=Version(edited),partName="Active part",quantity=1,unitPrice=1})).EnsureSuccessStatusCode();
        var fresh=await mechanic.GetFromJsonAsync<JsonElement>($"/api/ServiceJobs/{id}");
        var done=await Body(await mechanic.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(fresh),description="Completed",isCompleted=true}));
        foreach(var complete in new[]{true,false})Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(done),description="Unauthorized",isCompleted=complete})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.PostAsJsonAsync("/api/JobParts",new{serviceJobId=id,version=Version(done),partName="Unauthorized",quantity=1,unitPrice=1})).StatusCode);
        foreach(var route in new[]{"ServiceJobs/"+id,"parts/1","Customers/1","Vehicle/1","Appointments/1","Users/1"})Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.DeleteAsync("/api/"+route)).StatusCode);
        var corrected=await Body(await admin.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(done),description="Correction",isCompleted=true}));
        var reopened=await Body(await admin.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(corrected),description="Reopened",isCompleted=false}));
        (await mechanic.PutAsJsonAsync($"/api/ServiceJobs/{id}",new{version=Version(reopened),description="Working again"})).EnsureSuccessStatusCode();
        (await admin.DeleteAsync($"/api/ServiceJobs/{id}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict,(await admin.DeleteAsync("/api/Customers/1")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await admin.DeleteAsync("/api/Vehicle/1")).StatusCode);
        (await admin.DeleteAsync("/api/Appointments/1")).EnsureSuccessStatusCode();var history=await admin.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");
        Assert.Equal(JsonValueKind.Null,history.GetProperty("appointmentId").ValueKind);Assert.Single(history.GetProperty("jobParts").EnumerateArray());
    }
    [Fact]
    public async Task UpgradePreservesBusinessRecords_AndRejectsAmbiguousAccounts()
    {
        foreach(var duplicates in new[]{false,true}) {
            await using var connection=new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:");await connection.OpenAsync();
            await using var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
            await db.GetService<IMigrator>().MigrateAsync("20261029000100_AddSessionVersion");
            await db.Database.ExecuteSqlRawAsync("INSERT INTO Users (Name,Email,PasswordHash,Role,SessionVersion) VALUES ('One','Admin@Test.com','preserve','admin','original'); INSERT INTO Customers (Name,PhoneNumber) VALUES ('Preserve','123');");
            if(duplicates)await db.Database.ExecuteSqlRawAsync("INSERT INTO Users (Name,Email,PasswordHash,Role,SessionVersion) VALUES ('Two','admin@test.com','preserve2','mechanic','original');");
            if(duplicates) {
                var error=await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(()=>db.Database.MigrateAsync());Assert.Contains("Duplicate normalized usernames",error.Message);
                using var cmd=connection.CreateCommand();cmd.CommandText="SELECT count(*) FROM Users";Assert.Equal(2L,cmd.ExecuteScalar());
            } else {
                await db.Database.MigrateAsync();Assert.Equal("preserve",(await db.Users.SingleAsync()).PasswordHash);Assert.Single(db.Customers);Assert.False(db.Database.HasPendingModelChanges());
            }
        }
    }
}
