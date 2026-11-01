using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using CarServiceShop.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CarServiceShop.Tests;

public class Stage3DResourceTests
{
    private static async Task Seed(SecurityHost host,int count=235)
    {
        using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        for(var i=1;i<=count;i++) {
            var c=new Customer{Name=i==221?"ÁRVÍZ ŐR":"Member "+i,PhoneNumber="555-"+i,Email=$"member{i}@test.invalid"};
            var v=new Vehicle{Customer=c,LicensePlate="PAGE-"+i,Make="Ford",Model="Focus",Year=2020,MOTExpiry=new DateTime(2026,1,10).AddDays(i%40)};
            db.Vehicles.Add(v);db.Parts.Add(new Part{PartNumber="STOCK-"+i,Name="Grouped part "+i,StockQuantity=i%7,NetPrice=1,GrossPrice=2});
            db.Appointments.Add(new Appointment{Vehicle=v,StartTime=new DateTime(2026,1,10,9,0,0),EndTime=new DateTime(2026,1,10,10,0,0),Note="Booking "+i});
            db.ServiceJobs.Add(new ServiceJob{Vehicle=v,Date=new DateTime(2026,1,10),Description="Grouped job "+i,IsCompleted=i%2==0,LaborCost=5,JobParts=[new(){PartName="Snapshot",Quantity=2,UnitPrice=3}]});
        }
        await db.SaveChangesAsync();
    }
    private static Task<JsonElement> Json(HttpResponseMessage response)=>response.Content.ReadFromJsonAsync<JsonElement>();
    private static int Count(HttpResponseMessage response)=>int.Parse(response.Headers.GetValues("X-Total-Count").Single());

    [Fact]
    public async Task LargeDatasetPagesAreStableCompleteAndBoundedInSql()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host);
        var response=await client.GetAsync("/api/Customers");Assert.Equal(235,Count(response));Assert.Equal(50,(await Json(response)).GetArrayLength());
        var ids=new List<int>();var start=host.Logs.Messages.Count;
        for(var page=1;page<=3;page++) {
            var r=await client.GetAsync($"/api/Customers?page={page}&pageSize=100");r.EnsureSuccessStatusCode();
            var text=await r.Content.ReadAsStringAsync();Assert.True(Encoding.UTF8.GetByteCount(text)<100_000);
            ids.AddRange((await Json(r)).EnumerateArray().Select(x=>x.GetProperty("id").GetInt32()));
        }
        Assert.Equal(235,ids.Count);Assert.Equal(235,ids.Distinct().Count());Assert.Equal(ids.Order(),ids);
        var commands=host.Logs.Messages.Skip(start).Where(m=>m.Contains("Executed DbCommand")).ToList();
        Assert.InRange(commands.Count,6,12);Assert.Contains(commands,m=>m.Contains("LIMIT")&&m.Contains("OFFSET"));
        Assert.Empty((await Json(await client.GetAsync("/api/Customers?page=4&pageSize=100"))).EnumerateArray());
    }

    [Theory]
    [InlineData("page=0")] [InlineData("page=-1")] [InlineData("page=2147483647")]
    [InlineData("pageSize=0")] [InlineData("pageSize=101")] [InlineData("pageSize=999999999")]
    [InlineData("page=abc")]
    public async Task InvalidPagingFailsAcrossCollections(string query)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        foreach(var route in new[]{"Customers","Vehicle","ServiceJobs","ServiceJobs/ByVehicle/1","parts","Appointments","Users"})
            Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/"+route+"?"+query)).StatusCode);
    }

    [Fact]
    public async Task FiltersFindHistoricalRowsIncludingHungarianCaseAndLiteralInjectionText()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host);
        foreach(var q in new[]{"árvíz őr","555-221","member221@test.invalid"}) {
            var response=await client.GetAsync("/api/Customers?q="+Uri.EscapeDataString(q));Assert.Equal(1,Count(response));
            Assert.Equal(221,(await Json(response))[0].GetProperty("id").GetInt32());
        }
        Assert.Equal(1,Count(await client.GetAsync("/api/Vehicle?q="+Uri.EscapeDataString("árvíz őr"))));
        var jobs=await client.GetAsync("/api/ServiceJobs?status=completed&from=2026-01-01&to=2026-01-31&page=2&pageSize=10");
        Assert.Equal(117,Count(jobs));Assert.Equal(10,(await Json(jobs)).GetArrayLength());
        Assert.Equal(1,Count(await client.GetAsync("/api/ServiceJobs?vehicleId=221")));
        Assert.Equal(1,Count(await client.GetAsync("/api/ServiceJobs?q="+Uri.EscapeDataString("árvíz"))));
        var part=await client.GetAsync("/api/parts?partNumber=stock-221");Assert.Equal(1,Count(part));
        var stock=await client.GetAsync("/api/parts?q=grouped&stock=out&pageSize=10&page=2");Assert.Equal(33,Count(stock));Assert.Equal(10,(await Json(stock)).GetArrayLength());
        Assert.Equal(0,Count(await client.GetAsync("/api/Customers?q="+Uri.EscapeDataString("%' OR 1=1 --"))));
        Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/Vehicle?q="+new string('x',201))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/ServiceJobs?status=unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/ServiceJobs?from=2026-02-01&to=2026-01-01")).StatusCode);
    }

    [Fact]
    public async Task AppointmentsRequireBoundedValidRangesAndRetainOverlap()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host,3);
        var r=await client.GetAsync("/api/Appointments?start=2026-01-10T09:30:00&end=2026-01-11&pageSize=1");Assert.Equal(3,Count(r));Assert.Single((await Json(r)).EnumerateArray());
        foreach(var q in new[]{"start=2026-01-10","start=2026-02-01&end=2026-01-01","start=2026-01-01&end=2027-01-01","start=1800-01-01&end=1800-02-01"})
            Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/Appointments?"+q)).StatusCode);
        Assert.Equal(0,Count(await client.GetAsync("/api/Appointments?start=2026-02-01&end=2026-02-02")));
    }

    [Fact]
    public async Task DashboardUsesWholeDatasetCountsButOnlyBoundedPanels()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host);
        var r=await client.GetAsync("/api/Dashboard?date=2026-01-10&start=2026-01-10&end=2026-01-11");r.EnsureSuccessStatusCode();var data=await Json(r);
        Assert.Equal(235,data.GetProperty("todayCount").GetInt32());Assert.Equal(118,data.GetProperty("activeCount").GetInt32());Assert.Equal(117,data.GetProperty("completedCount").GetInt32());
        Assert.Equal(185,data.GetProperty("inspectionCount").GetInt32());Assert.Equal(185,data.GetProperty("upcomingCount").GetInt32());Assert.Equal(169,data.GetProperty("lowCount").GetInt32());
        foreach(var field in new[]{"bookings","active","recent","inspections","low"})Assert.InRange(data.GetProperty(field).GetArrayLength(),0,6);
    }

    [Fact]
    public async Task DashboardPreservesInspectionAndStockBusinessBoundaries()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host,1);
        using(var scope=host.Services.CreateScope()){
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            foreach(var expiry in new DateTime?[]{new(2026,1,9),new(2026,1,10),new(2026,2,9),new(2026,2,10),null})
                db.Vehicles.Add(new(){CustomerId=1,LicensePlate="Boundary "+expiry,Make="Ford",Model="Focus",MOTExpiry=expiry});
            foreach(var stock in new[]{-1,0,4,5})db.Parts.Add(new(){Name="Legacy boundary",PartNumber="BOUNDARY-"+stock,StockQuantity=stock});
            await db.SaveChangesAsync();
        }
        var data=await Json(await client.GetAsync("/api/Dashboard?date=2026-01-10&start=2026-01-10&end=2026-01-11"));
        Assert.Equal(4,data.GetProperty("inspectionCount").GetInt32());Assert.Equal(3,data.GetProperty("upcomingCount").GetInt32());Assert.Equal(3,data.GetProperty("lowCount").GetInt32());
        Assert.Equal(new[]{0,1,4},data.GetProperty("low").EnumerateArray().Select(p=>p.GetProperty("stockQuantity").GetInt32()));
    }

    [Theory] [InlineData(false)] [InlineData(true)]
    public async Task OversizedJsonIsControlledBeforePersistence(bool chunked)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        var bytes=Encoding.UTF8.GetBytes("{\"name\":\""+new string('x',RequestBounds.JsonBytes)+"\",\"phoneNumber\":\"1\"}");
        using HttpContent content=chunked?new UnknownLengthContent(bytes):new ByteArrayContent(bytes);content.Headers.ContentType=new("application/json");
        var response=await client.PostAsync("/api/Customers",content);Assert.Equal(HttpStatusCode.RequestEntityTooLarge,response.StatusCode);
        Assert.DoesNotContain("Exception",await response.Content.ReadAsStringAsync());
        using var scope=host.Services.CreateScope();Assert.Empty(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Customers);
    }

    [Fact]
    public async Task ValidLargeWorksheetSucceedsButEveryWritePathEnforces500AndListPreviewIsBounded()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host,1);
        var lines=Enumerable.Range(0,500).Select(i=>new {partName="Saved line "+i,quantity=1,unitPrice=1}).ToArray();
        var r=await client.PostAsJsonAsync("/api/ServiceJobs",new {vehicleId=1,description="Valid large business request",jobParts=lines});r.EnsureSuccessStatusCode();var job=await Json(r);var id=job.GetProperty("id").GetInt32();
        Assert.Equal(500,job.GetProperty("jobParts").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/JobParts",new {serviceJobId=id,version=job.GetProperty("version").GetString(),partName="Extra",quantity=1,unitPrice=1})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PutAsJsonAsync("/api/ServiceJobs/"+id,new {version=job.GetProperty("version").GetString(),description="Too many",jobParts=lines.Append(lines[0])})).StatusCode);
        var preview=(await Json(await client.GetAsync("/api/ServiceJobs?vehicleId=1")))[0];Assert.Equal(500,preview.GetProperty("lineItemCount").GetInt32());Assert.Equal(20,preview.GetProperty("jobParts").GetArrayLength());Assert.Equal(500,preview.GetProperty("partsTotal").GetInt64());
        Assert.Equal(500,(await Json(await client.GetAsync("/api/ServiceJobs/"+id))).GetProperty("jobParts").GetArrayLength());
    }

    [Fact]
    public async Task RepeatedSearchesAreRateBoundedAndAuthenticationStillApplies()
    {
        using var host=new SecurityHost();using var configured=host.WithWebHostBuilder(b=>b.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(new Dictionary<string,string?>{["Reads:PermitLimit"]="30"})));
        using var client=configured.CreateClient(new(){BaseAddress=new Uri("https://localhost")});host.AddUser("owner");
        var login=await client.PostAsJsonAsync("/api/Auth/login",new {email="owner",password="Synthetic-password-123"});login.EnsureSuccessStatusCode();client.DefaultRequestHeaders.Authorization=new("Bearer",(await Json(login)).GetProperty("token").GetString());
        for(var i=0;i<30;i++)Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Customers?q=bounded&pageSize=1")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests,(await client.GetAsync("/api/Customers?pageSize=1")).StatusCode);
        client.DefaultRequestHeaders.Authorization=null;Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Customers")).StatusCode);
    }

    [Fact]
    public async Task UploadGateHasNoQueueAndManagedStorageHasBoundedAccounting()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var images=host.Services.GetRequiredService<ProfileImages>();
        using(var held=await images.LockAsync()) {
            using var body=new MultipartFormDataContent();var file=new ByteArrayContent([1,2]);file.Headers.ContentType=new("image/png");body.Add(file,"file","profile.png");
            Assert.Equal(HttpStatusCode.TooManyRequests,(await client.PostAsync("/api/Auth/upload-profile-picture",body)).StatusCode);
        }
        Assert.False(images.HasRoom(1,null,ProfileImages.MaxStoredBytes+1));
        for(var i=0;i<1025;i++)await File.WriteAllBytesAsync(Path.Combine(images.DirectoryPath,$"profile_1_{i}.png"),[]);
        Assert.False(images.HasRoom(1,null,1));
        await File.WriteAllTextAsync(Path.Combine(images.DirectoryPath,"unrelated-business-file.txt"),"preserve");
        images.DeleteOwned(1,"../unrelated-business-file.txt");Assert.True(File.Exists(Path.Combine(images.DirectoryPath,"unrelated-business-file.txt")));
    }

    [Fact]
    public async Task ManagedStorageByteBudgetAndAccountCleanupPreserveUnrelatedFiles()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();host.AddUser("worker",role:"mechanic");
        var images=host.Services.GetRequiredService<ProfileImages>();var large=Path.Combine(images.DirectoryPath,"profile_99_capacity.png");
        await using(var file=new FileStream(large,FileMode.CreateNew))file.SetLength(ProfileImages.StorageBytes);
        Assert.False(images.HasRoom(1,null,1));Assert.True(images.HasRoom(99,"profile_99_capacity.png",1));File.Delete(large);
        var owned=Path.Combine(images.DirectoryPath,"profile_2_owned.png");await File.WriteAllTextAsync(owned,"synthetic");
        var unrelated=Path.Combine(images.DirectoryPath,"business-document.txt");await File.WriteAllTextAsync(unrelated,"preserve");
        using(var scope=host.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();var user=await db.Users.SingleAsync(u=>u.Id==2);user.ProfilePicturePath=Path.GetFileName(owned);await db.SaveChangesAsync();}
        (await client.DeleteAsync("/api/Users/2")).EnsureSuccessStatusCode();Assert.False(File.Exists(owned));Assert.True(File.Exists(unrelated));
    }

    [Fact]
    public async Task UploadRateLimitIsFiniteWithoutLockingTheAccount()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        for(var i=0;i<11;i++){
            using var body=new MultipartFormDataContent();var file=new ByteArrayContent([1]);file.Headers.ContentType=new("text/plain");body.Add(file,"file","invalid.txt");
            Assert.Equal(i<10?HttpStatusCode.BadRequest:HttpStatusCode.TooManyRequests,(await client.PostAsync("/api/Auth/upload-profile-picture",body)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
    }

    [Fact]
    public async Task AllPagedCollectionsRespectTheSameCapAndAccountsExposeNoSecrets()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host);
        using(var scope=host.Services.CreateScope()){
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Users.AddRange(Enumerable.Range(1,150).Select(i=>new User{Name="Synthetic "+i,Email="paging-account-"+i,PasswordHash="unused synthetic hash",Role="mechanic"}));
            db.ServiceJobs.AddRange(Enumerable.Range(1,60).Select(i=>new ServiceJob{VehicleId=1,Description="History "+i}));await db.SaveChangesAsync();
        }
        foreach(var route in new[]{"Customers","Vehicle","ServiceJobs","ServiceJobs/ByVehicle/1","parts","Users"}){
            var first=await client.GetAsync("/api/"+route);Assert.Equal(50,(await Json(first)).GetArrayLength());
            var maximum=await client.GetAsync("/api/"+route+"?pageSize=100");var rows=await Json(maximum);Assert.Equal(Math.Min(100,Count(maximum)),rows.GetArrayLength());
        }
        var users=await client.GetAsync("/api/Users");var body=await users.Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash",body);Assert.DoesNotContain("sessionVersion",body);Assert.DoesNotContain("normalizedLogin",body);Assert.Equal("1",users.Headers.GetValues("X-Admin-Count").Single());
    }

    [Fact]
    public async Task DashboardHonorsExplicitLocalDayUtcBoundaries()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();await Seed(host,1);
        using(var scope=host.Services.CreateScope()){
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            foreach(var start in new[]{new DateTime(2026,1,9,23,30,0),new DateTime(2026,1,9,22,59,0),new DateTime(2026,1,10,23,30,0)})db.Appointments.Add(new(){VehicleId=1,StartTime=start,EndTime=start.AddMinutes(10)});
            await db.SaveChangesAsync();
        }
        var data=await Json(await client.GetAsync("/api/Dashboard?date=2026-01-10&start=2026-01-09T23:00:00Z&end=2026-01-10T23:00:00Z"));Assert.Equal(2,data.GetProperty("todayCount").GetInt32());
    }

    [Fact]
    public async Task ExpensiveWorksheetWritesAreRateBoundedBeforePersistence()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        for(var i=0;i<121;i++)Assert.Equal(i<120?HttpStatusCode.BadRequest:HttpStatusCode.TooManyRequests,(await client.PostAsJsonAsync("/api/ServiceJobs",new {vehicleId=999999,description="Invalid reference"})).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
        using var scope=host.Services.CreateScope();Assert.Empty(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().ServiceJobs);
    }

    private sealed class UnknownLengthContent(byte[] bytes) : HttpContent
    {
        protected override bool TryComputeLength(out long length){length=0;return false;}
        protected override Task SerializeToStreamAsync(Stream stream,TransportContext? context)=>stream.WriteAsync(bytes).AsTask();
    }
}
