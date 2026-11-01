using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CarServiceShop.Tests;

public class FinalSecurityReauditTests
{
    [Fact]
    public async Task DirectAppendHonorsAggregateCeilingIncludingLabor_WithoutFalseAuditOrPartialWrite()
    {
        using var host=new SecurityHost();host.AddUser("worker",role:"mechanic");using var client=host.Client();
        var signed=await client.PostAsJsonAsync("/api/Auth/login",new {email="worker",password="Synthetic-password-123"});signed.EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Authorization=new("Bearer",(await signed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString());
        using(var scope=host.Services.CreateScope()){
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Vehicles.Add(new Vehicle {Customer=new Customer{Name="Synthetic",PhoneNumber="123"},LicensePlate="SYNTHETIC"});await db.SaveChangesAsync();
        }
        var created=await client.PostAsJsonAsync("/api/ServiceJobs",new {vehicleId=1,description="Boundary",laborCost=1,jobParts=new[]{new {partName="Large valid snapshot",quantity=9999,unitPrice=100_000_000}}});created.EnsureSuccessStatusCode();var job=await created.Content.ReadFromJsonAsync<JsonElement>();
        var exact=await client.PostAsJsonAsync("/api/JobParts",new {serviceJobId=1,version=job.GetProperty("version").GetString(),partName="At ceiling",quantity=1,unitPrice=99_999_999});exact.EnsureSuccessStatusCode();
        var atLimit=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");var version=atLimit.GetProperty("version").GetString();int auditCount;
        using(var scope=host.Services.CreateScope())auditCount=await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().AuditEvents.CountAsync();
        var above=await client.PostAsJsonAsync("/api/JobParts",new {serviceJobId=1,version,partName="Over ceiling",quantity=1,unitPrice=1});
        Assert.Equal(HttpStatusCode.BadRequest,above.StatusCode);
        var stored=await client.GetFromJsonAsync<JsonElement>("/api/ServiceJobs/1");Assert.Equal(version,stored.GetProperty("version").GetString());Assert.Equal(2,stored.GetProperty("jobParts").GetArrayLength());
        using var verify=host.Services.CreateScope();Assert.Equal(auditCount,await verify.ServiceProvider.GetRequiredService<ApplicationDbContext>().AuditEvents.CountAsync());
    }
}
