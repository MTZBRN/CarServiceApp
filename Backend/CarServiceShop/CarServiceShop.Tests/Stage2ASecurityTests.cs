using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace CarServiceShop.Tests;

public class Stage2ASecurityTests
{
    [Theory] [InlineData(null)] [InlineData("retired")]
    public async Task VersionlessOrStaleSignedTokensAreRejected(string? version)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        var claims=new List<System.Security.Claims.Claim> {new(System.Security.Claims.ClaimTypes.NameIdentifier,"1"),new(System.Security.Claims.ClaimTypes.Role,"admin")};
        if(version!=null)claims.Add(new("session_version",version));
        var handler=new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var token=handler.CreateToken(new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor {
            Subject=new System.Security.Claims.ClaimsIdentity(claims),Expires=DateTime.UtcNow.AddMinutes(10),
            SigningCredentials=new(new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(Convert.FromBase64String(host.Key)),Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256)
        });
        client.DefaultRequestHeaders.Authorization=new("Bearer",handler.WriteToken(token));
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
    }
    [Fact]
    public async Task ExistingUserMigrationPreservesHashAndAddsInitialVersion()
    {
        await using var connection=new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261027000100_PreserveAppointmentHistory");
        var hash=BCrypt.Net.BCrypt.HashPassword("Migration-only-password",4);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Users (Name,Email,PasswordHash,Role) VALUES ({"Existing"},{"existing"},{hash},{"admin"})");
        await db.Database.MigrateAsync(); var user=await db.Users.SingleAsync();
        Assert.Equal(hash,user.PasswordHash);Assert.Equal("initial",user.SessionVersion);
        Assert.False(db.Database.HasPendingModelChanges());
    }
    private static async Task<string> Login(HttpClient client,string password="Synthetic-password-123",string email="owner") {
        var r=await client.PostAsJsonAsync("/api/Auth/login",new{email,password}); r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }
    [Fact]
    public async Task PasswordChangeRevokesAllOldTokens_ReplacementAndNewLoginWork()
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn(); using var other=host.Client();
        other.DefaultRequestHeaders.Authorization=new("Bearer",await Login(other));
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
        var response=await client.PostAsJsonAsync("/api/Auth/change-password",new{oldPassword="Synthetic-password-123",newPassword="Replacement-password-123"});response.EnsureSuccessStatusCode();
        var token=(await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,(await other.GetAsync("/api/Auth/me")).StatusCode);
        client.DefaultRequestHeaders.Authorization=new("Bearer",token);
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
        client.DefaultRequestHeaders.Authorization=new("Bearer",await Login(client,"Replacement-password-123"));
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
    }
    [Fact]
    public async Task LogoutRevokesOnlyAuthenticatedIdentity_AllItsTokensFail()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();using var second=host.Client();using var victim=host.Client();
        second.DefaultRequestHeaders.Authorization=new("Bearer",await Login(second));
        host.AddUser("another",role:"mechanic"); victim.DefaultRequestHeaders.Authorization=new("Bearer",await Login(victim,email:"another"));
        // Supplied identifiers have no effect: logout always derives identity from validated claims.
        Assert.Equal(HttpStatusCode.NoContent,(await client.PostAsJsonAsync("/api/Auth/logout",new{userId=2,id=2})).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,(await second.GetAsync("/api/Auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await victim.GetAsync("/api/Auth/me")).StatusCode);
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task DeletedOrRoleChangedUserStillRejected(bool delete)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        host.AddUser("surviving-admin");
        using(var scope=host.Services.CreateScope()) {
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();var user=await db.Users.SingleAsync(u=>u.Email=="owner");
            if(delete)db.Users.Remove(user);else user.Role="mechanic";await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
    }
    private static void Records(SecurityHost host) {
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var c=new Customer{Name="Owner",PhoneNumber="123"};
        var v=new Vehicle{Customer=c,LicensePlate="ONE",Make="Ford",Model="Focus",Year=2020};
        db.Vehicles.AddRange(v,new Vehicle{Customer=c,LicensePlate="TWO",Make="Ford",Model="Focus",Year=2020});
        var a=new Appointment{Vehicle=v,StartTime=new DateTime(2026,1,1),EndTime=new DateTime(2026,1,1,1,0,0)};
        db.ServiceJobs.Add(new ServiceJob{Vehicle=v,Appointment=a,Description="Original",JobParts=[new JobPart{PartName="Original",Quantity=1,UnitPrice=100}]});db.SaveChanges();
    }
    [Fact]
    public async Task NestedGraphsAndChildIdsCannotCreateOrOverwriteUnintendedRecords()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        (await client.PostAsJsonAsync("/api/Vehicle",new{customerId=1,licensePlate="SAFE",make="Ford",model="Focus",year=2020,customer=new{name="Injected",phoneNumber="123"}})).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/Appointments",new{vehicleId=1,startTime="2026-01-02",endTime="2026-01-02",vehicle=new{licensePlate="Injected"},serviceJob=new{vehicleId=2,description="Injected"}})).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/ServiceJobs",new{vehicleId=1,description="New",jobParts=new[]{new{id=1,serviceJobId=1,partName="Safe snapshot",quantity=2,unitPrice=100}}})).EnsureSuccessStatusCode();
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1,await db.Customers.CountAsync());Assert.Equal(3,await db.Vehicles.CountAsync());Assert.Equal(2,await db.ServiceJobs.CountAsync());
        Assert.Equal("Original",(await db.JobParts.FindAsync(1))!.PartName);Assert.Equal(2,await db.JobParts.CountAsync());
    }
    public static IEnumerable<object[]> InvalidInputs()
    {
        object[] C(string route,object body,string method="POST")=>[route,JsonSerializer.Serialize(body),method];
        yield return C("Customers",new{name="",phoneNumber="123"});
        yield return C("Customers",new{name="Name",phoneNumber=""});
        yield return C("Customers",new{name=new string('a',201),phoneNumber="123"});
        yield return C("Customers",new{name="Name",phoneNumber="123",email="invalid"});
        yield return C("Customers/1",new{id=2,name="Name",phoneNumber="123"},"PUT");
        yield return C("Vehicle",new{customerId=999,licensePlate="SAFE",make="Ford",model="Focus",year=2020});
        yield return C("Vehicle",new{customerId=1,licensePlate=" ",make="Ford",model="Focus",year=2020});
        yield return C("Vehicle",new{customerId=1,licensePlate="SAFE",make=new string('a',101),model="Focus",year=2020});
        yield return C("Vehicle",new{customerId=1,licensePlate="SAFE",make="Ford",model="Focus",year=2020,motExpiry="0001-01-01"});
        yield return C("Appointments",new{vehicleId=999,startTime="2026-01-01",endTime="2026-01-02"});
        yield return C("Appointments",new{vehicleId=1,startTime="2026-01-02",endTime="2026-01-01"});
        yield return C("Appointments",new{vehicleId=1,startTime="2026-01-01",endTime="2026-01-02",note=new string('x',5001)});
        yield return C("Appointments/1",new{id=2,vehicleId=1,startTime="2026-01-01",endTime="2026-01-02"},"PUT");
        yield return C("ServiceJobs",new{vehicleId=1,description="Test",laborCost=-1});
        foreach(var quantity in new[]{0,-1,10001}) yield return C("ServiceJobs",new{vehicleId=1,description="Test",jobParts=new[]{new{partName="Test",quantity,unitPrice=1}}});
        yield return C("ServiceJobs",new{vehicleId=1,description="Test",jobParts=new[]{new{partName="Test",quantity=1,unitPrice=-1}}});
        yield return C("ServiceJobs",new{vehicleId=1,description="Test",laborCost=int.MaxValue});
        yield return C("ServiceJobs",new{vehicleId=2,appointmentId=1,description="Test"});
        yield return C("ServiceJobs",new{vehicleId=1,appointmentId=999,description="Test"});
        yield return C("ServiceJobs",new{vehicleId=999,description="Test"});
        yield return C("ServiceJobs/1",new{id=2,description="Test"},"PUT");
        yield return C("ServiceJobs",new{vehicleId=1,description="Test",jobParts=new object?[]{null}});
        yield return C("JobParts",new{serviceJobId=999,partName="Test",quantity=1,unitPrice=1});
        yield return C("JobParts",new{serviceJobId=1,partName="Test",quantity=0,unitPrice=1});
        foreach(var stock in new[]{-1,1000001}) yield return C("Parts",new{partNumber="SAFE",name="Test",stockQuantity=stock});
        yield return C("Parts",new{partNumber="SAFE",name="Test",netPrice=-1});
        yield return C("Parts",new{partNumber="SAFE",name="Test",grossPrice=-1});
        yield return C("Parts",new{partNumber="SAFE",name=new string('a',201)});
        yield return C("Parts/1",new{id=2,partNumber="SAFE",name="Test"},"PUT");
        foreach(var rate in new[]{-1,1000001}) yield return C("Settings",new{hourlyRate=rate,vatRate=0});
        foreach(var vat in new[]{-1,101}) yield return C("Settings",new{hourlyRate=0,vatRate=vat});
        yield return C("Settings",new{email="bad"});
        yield return C("Users",new{name="Name",email="user",password="Synthetic-password-123",role="superuser"});
        yield return C("Users",new{name=new string('x',201),email="user",password="Synthetic-password-123",role="mechanic"});
        yield return C("Users",new{name="Name",email="bad@",password="Synthetic-password-123",role="mechanic"});
        yield return C("Users",new{name="Name",email="user",password="short",role="mechanic"});
    }
    [Theory] [MemberData(nameof(InvalidInputs))]
    public async Task InvalidInputReturns400WithoutChangingRecords(string route,string json,string method)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        using var content=new StringContent(json,System.Text.Encoding.UTF8,"application/json");
        var r=await client.SendAsync(new HttpRequestMessage(new HttpMethod(method),"/api/"+route){Content=content});
        Assert.Equal(HttpStatusCode.BadRequest,r.StatusCode);
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1,await db.Customers.CountAsync());Assert.Equal(2,await db.Vehicles.CountAsync());Assert.Equal(1,await db.ServiceJobs.CountAsync());
        Assert.Equal("Original",(await db.ServiceJobs.SingleAsync()).Description);Assert.Empty(db.Parts);Assert.Single(db.Users);
    }
    [Fact]
    public async Task LinkedAppointmentStillLocked_ZeroSettingsRemainValid()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();Records(host);
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync("/api/Appointments/1",new{version=(await client.GetFromJsonAsync<JsonElement>("/api/Appointments/1")).GetProperty("version").GetString(),id=1,vehicleId=2,startTime="2026-01-01",endTime="2026-01-02"})).StatusCode);
        (await client.PostAsJsonAsync("/api/Settings",new{hourlyRate=0,vatRate=0})).EnsureSuccessStatusCode();
        var data=await client.GetFromJsonAsync<JsonElement>("/api/Settings");Assert.Equal(0,data.GetProperty("hourlyRate").GetDecimal());Assert.Equal(0,data.GetProperty("vatRate").GetInt32());
    }
}
