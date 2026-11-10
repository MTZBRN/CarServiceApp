using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using CarServiceShop.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

namespace CarServiceShop.Tests;

public class Stage3EAuditTests
{
    private static Task<JsonElement> Json(HttpResponseMessage response)=>response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task SaveCompany(HttpClient client) =>
        (await client.PostAsJsonAsync("/api/Settings", new { companyName = "Fixture Workshop" })).EnsureSuccessStatusCode();
    private static List<AuditEvent> Events(SecurityHost host){using var scope=host.Services.CreateScope();return scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().AuditEvents.AsNoTracking().OrderBy(e=>e.Id).ToList();}
    private static async Task<int> Vehicle(HttpClient client){var c=await client.PostAsJsonAsync("/api/Customers",new {name="PRIVATE CUSTOMER",phoneNumber="123",address="PRIVATE ADDRESS"});c.EnsureSuccessStatusCode();var v=await client.PostAsJsonAsync("/api/Vehicle",new {customerId=(await Json(c)).GetProperty("id").GetInt32(),licensePlate="PRIVATE-PLATE",make="Ford",model="Focus",year=2020});v.EnsureSuccessStatusCode();return (await Json(v)).GetProperty("id").GetInt32();}
    private static async Task<JsonElement> Job(HttpClient client,int vehicleId){var r=await client.PostAsJsonAsync("/api/ServiceJobs",new {vehicleId,description="PRIVATE NOTES",laborCost=100,jobParts=new[]{new {partName="PRIVATE ITEM",quantity=1,unitPrice=2}}});r.EnsureSuccessStatusCode();return await Json(r);}

    [Fact]
    public async Task LoginPasswordAndLogoutAreAuditedWithoutCredentials()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        var login=Assert.Single(Events(host));Assert.Equal("Auth.LoginSucceeded",login.Action);Assert.Equal(1,login.ActorUserId);Assert.Equal("admin",login.ActorRole);Assert.Equal(DateTimeKind.Utc,login.TimestampUtc.Kind);
        var changed=await client.PostAsJsonAsync("/api/Auth/change-password",new {oldPassword="Synthetic-password-123",newPassword="Changed-password-123"});changed.EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Authorization=new("Bearer",(await Json(changed)).GetProperty("token").GetString());
        (await client.PostAsync("/api/Auth/logout",null)).EnsureSuccessStatusCode();Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
        var events=Events(host);Assert.Equal(new[]{"Auth.LoginSucceeded","Auth.PasswordChanged","Auth.SessionRevoked"},events.Select(e=>e.Action));
        var text=JsonSerializer.Serialize(events);foreach(var secret in new[]{"Synthetic-password-123","Changed-password-123","session_version","PasswordHash","Bearer","eyJ"})Assert.DoesNotContain(secret,text);
    }

    [Fact]
    public async Task FailedLoginsAreGloballySampledAndResponsesStayGeneric()
    {
        using var host=new SecurityHost();host.AddUser();using var client=host.Client();var bodies=new List<string>();
        for(var i=0;i<15;i++){var r=await client.PostAsJsonAsync("/api/Auth/login",new {email=i==0?"owner":"ATTACKER-NAME-"+i,password="wrong-password"});Assert.Contains(r.StatusCode,new[]{HttpStatusCode.Unauthorized,HttpStatusCode.TooManyRequests});if(r.StatusCode==HttpStatusCode.Unauthorized)bodies.Add(await r.Content.ReadAsStringAsync());}
        Assert.Single(bodies.Distinct());var item=Assert.Single(Events(host));Assert.Equal("Auth.LoginFailed",item.Action);Assert.Equal("Failure",item.Outcome);Assert.Equal(1,item.ActorUserId);
        var text=JsonSerializer.Serialize(item);Assert.DoesNotContain("ATTACKER-NAME",text);Assert.DoesNotContain("wrong-password",text);
        var budget=new AuditFailureBudget();Assert.True(budget.Take());for(var i=0;i<10000;i++)Assert.False(budget.Take());
    }

    [Fact]
    public async Task UnknownLoginDoesNotPersistTheAttemptedIdentifier()
    {
        using var host=new SecurityHost();using var client=host.Client();var r=await client.PostAsJsonAsync("/api/Auth/login",new {email="<img src=x onerror=attack()>\n",password="wrong-password"});Assert.Equal(HttpStatusCode.Unauthorized,r.StatusCode);
        var item=Assert.Single(Events(host));Assert.Null(item.ActorUserId);Assert.Equal("",item.ActorName);Assert.Equal("{}",item.Details);
    }

    [Fact]
    public async Task AccountAdministrationPersistsTargetRoleAndSurvivesDeletion()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        (await client.PostAsJsonAsync("/api/Users",new {name="PRIVATE PERSON",email="private-user",password="Private-password-123",role="mechanic"})).EnsureSuccessStatusCode();
        (await client.DeleteAsync("/api/Users/2")).EnsureSuccessStatusCode();
        var events=Events(host).Where(e=>e.ResourceId==2).ToList();Assert.Equal(new[]{"User.Created","User.Deleted"},events.Select(e=>e.Action));Assert.All(events,e=>Assert.Equal(1,e.ActorUserId));
        var details=string.Join("",events.Select(e=>e.Details));Assert.Contains("mechanic",details);Assert.DoesNotContain("PRIVATE PERSON",details);Assert.DoesNotContain("private-user",details);Assert.DoesNotContain("Private-password",details);
    }

    [Fact]
    public async Task CustomerVehicleAndAppointmentMutationsRecordMinimalDeltas()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var vehicleId=await Vehicle(client);
        (await client.PutAsJsonAsync("/api/Customers/1",new {name="PRIVATE RENAMED",phoneNumber="456",email="private@example.invalid",address="PRIVATE ROAD"})).EnsureSuccessStatusCode();
        var created=await client.PostAsJsonAsync("/api/Appointments",new {vehicleId,startTime="2026-11-01T09:00:00",endTime="2026-11-01T10:00:00",note="PRIVATE APPOINTMENT"});created.EnsureSuccessStatusCode();var app=await Json(created);var id=app.GetProperty("id").GetInt32();
        (await client.PutAsJsonAsync("/api/Appointments/"+id,new {vehicleId,version=app.GetProperty("version").GetString(),startTime="2026-11-02T09:00:00",endTime="2026-11-02T10:00:00",note="PRIVATE CHANGED"})).EnsureSuccessStatusCode();
        (await client.DeleteAsync("/api/Appointments/"+id)).EnsureSuccessStatusCode();(await client.DeleteAsync("/api/Vehicle/"+vehicleId)).EnsureSuccessStatusCode();(await client.DeleteAsync("/api/Customers/1")).EnsureSuccessStatusCode();
        var events=Events(host);foreach(var action in new[]{"Customer.Created","Customer.Updated","Customer.Deleted","Vehicle.Created","Vehicle.Deleted","Appointment.Created","Appointment.Updated","Appointment.Deleted"})Assert.Single(events,e=>e.Action==action);
        var update=events.Single(e=>e.Action=="Appointment.Updated");Assert.Contains("2026-11-01T09:00:00",update.Details);Assert.Contains("2026-11-02T09:00:00",update.Details);Assert.DoesNotContain("PRIVATE",string.Join("",events.Select(e=>e.Details)));
    }

    [Fact]
    public async Task WorksheetLifecycleAndDirectLinesProduceOneBusinessEventPerAction()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var job=await Job(client,await Vehicle(client));var id=job.GetProperty("id").GetInt32();
        async Task Update(bool complete,int labor){var r=await client.PutAsJsonAsync("/api/ServiceJobs/"+id,new {version=job.GetProperty("version").GetString(),description="PRIVATE DESCRIPTION",laborCost=labor,isCompleted=complete,jobParts=new[]{new{partName="PRIVATE",quantity=1,unitPrice=2}}});r.EnsureSuccessStatusCode();job=await Json(r);}
        await SaveCompany(client);
        await Update(false,200);await Update(true,200);await Update(true,300);await Update(false,300);
        (await client.PostAsJsonAsync("/api/JobParts",new {serviceJobId=id,version=job.GetProperty("version").GetString(),partName="PRIVATE EXTRA",quantity=1,unitPrice=1})).EnsureSuccessStatusCode();
        job=await Json(await client.GetAsync("/api/ServiceJobs/"+id));await Update(true,300);(await client.DeleteAsync("/api/ServiceJobs/"+id)).EnsureSuccessStatusCode();
        var rows=Events(host).Where(e=>e.ResourceType=="Worksheet").ToList();Assert.Equal(new[]{"Worksheet.Created","Worksheet.Updated","Worksheet.Completed","Worksheet.CompletedCorrected","Worksheet.Reopened","Worksheet.LineItemAdded","Worksheet.Completed","Worksheet.Deleted"},rows.Select(e=>e.Action));
        Assert.Contains("IsCompleted",rows[2].Details);Assert.Contains("LaborCost",rows[1].Details);Assert.All(rows,e=>Assert.DoesNotContain("PRIVATE",e.Details));
    }

    [Fact]
    public async Task UnauthorizedMechanicCannotProduceFalseHistorySuccess()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var job=await Job(client,await Vehicle(client));var id=job.GetProperty("id").GetInt32();
        await SaveCompany(client);
        var completed=await client.PutAsJsonAsync("/api/ServiceJobs/"+id,new {version=job.GetProperty("version").GetString(),description="Complete",isCompleted=true});completed.EnsureSuccessStatusCode();job=await Json(completed);
        host.AddUser("worker",role:"mechanic");using var mechanic=host.Client();var login=await mechanic.PostAsJsonAsync("/api/Auth/login",new {email="worker",password="Synthetic-password-123"});mechanic.DefaultRequestHeaders.Authorization=new("Bearer",(await Json(login)).GetProperty("token").GetString());var count=Events(host).Count;
        Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.PutAsJsonAsync("/api/ServiceJobs/"+id,new {version=job.GetProperty("version").GetString(),description="Unauthorized",isCompleted=false})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.DeleteAsync("/api/ServiceJobs/"+id)).StatusCode);Assert.Equal(HttpStatusCode.Forbidden,(await mechanic.PostAsJsonAsync("/api/JobParts",new {serviceJobId=id,version=job.GetProperty("version").GetString(),partName="Unauthorized",quantity=1,unitPrice=1})).StatusCode);
        Assert.Equal(count,Events(host).Count);
    }

    [Fact]
    public async Task InventoryAndSettingsAuditsContainOnlyAllowedOperationalValues()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        var created=await client.PostAsJsonAsync("/api/parts",new {name="PRIVATE PART",partNumber="PRIVATE CODE",stockQuantity=10,netPrice=100,grossPrice=127});created.EnsureSuccessStatusCode();var part=await Json(created);
        (await client.PutAsJsonAsync("/api/parts/1",new {version=part.GetProperty("version").GetString(),name="PRIVATE PART",partNumber="PRIVATE CODE",stockQuantity=4,netPrice=100,grossPrice=127})).EnsureSuccessStatusCode();(await client.DeleteAsync("/api/parts/1")).EnsureSuccessStatusCode();
        var settings=await client.PostAsJsonAsync("/api/Settings",new {companyName="PRIVATE COMPANY",address="PRIVATE ADDRESS",hourlyRate=15000,vatRate=27});settings.EnsureSuccessStatusCode();var saved=await Json(settings);
        (await client.PostAsJsonAsync("/api/Settings",new {version=saved.GetProperty("version").GetString(),companyName="PRIVATE COMPANY",address="PRIVATE ADDRESS",hourlyRate=17000,vatRate=0})).EnsureSuccessStatusCode();
        var events=Events(host);Assert.Equal(3,events.Count(e=>e.ResourceType=="Inventory"));var inventory=events.Single(e=>e.Action=="Inventory.Updated");Assert.Contains("\"before\":10,\"after\":4",inventory.Details);
        var updated=events.Single(e=>e.Action=="Settings.Updated");Assert.Contains("HourlyRate",updated.Details);Assert.Contains("17000",updated.Details);Assert.Contains("VatRate",updated.Details);Assert.DoesNotContain("PRIVATE",string.Join("",events.Select(e=>e.Details)));
    }

    [Fact]
    public async Task AuditReadIsAdminOnlyAndHasNoClientMutationRoutes()
    {
        using var host=new SecurityHost();using var admin=await host.SignedIn();using var anonymous=host.Client();Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/Audit")).StatusCode);
        host.AddUser("worker",role:"mechanic");var login=await anonymous.PostAsJsonAsync("/api/Auth/login",new {email="worker",password="Synthetic-password-123"});anonymous.DefaultRequestHeaders.Authorization=new("Bearer",(await Json(login)).GetProperty("token").GetString());Assert.Equal(HttpStatusCode.Forbidden,(await anonymous.GetAsync("/api/Audit")).StatusCode);
        (await admin.GetAsync("/api/Audit")).EnsureSuccessStatusCode();var count=Events(host).Count;
        foreach(var method in new[]{HttpMethod.Post,HttpMethod.Put,HttpMethod.Delete})Assert.Equal(HttpStatusCode.MethodNotAllowed,(await admin.SendAsync(new HttpRequestMessage(method,"/api/Audit"))).StatusCode);
        Assert.Equal(count,Events(host).Count);
    }

    [Fact]
    public async Task AuditPagingFiltersAndOrderingUseBoundedContract()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        using(var scope=host.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();db.AuditEvents.AddRange(Enumerable.Range(1,125).Select(i=>new AuditEvent {TimestampUtc=new DateTime(2026,1,1,0,0,0,DateTimeKind.Utc).AddMinutes(i),ActorUserId=7,ActorName="Fixture",ActorRole="admin",Action="Customer.Created",ResourceType="Customer",ResourceId=i,Outcome="Success"}));await db.SaveChangesAsync();}
        var first=await client.GetAsync("/api/Audit?resourceType=Customer");Assert.Equal("125",first.Headers.GetValues("X-Total-Count").Single());var rows=await Json(first);Assert.Equal(50,rows.GetArrayLength());Assert.Equal(125,rows[0].GetProperty("resourceId").GetInt32());Assert.Equal(76,rows[49].GetProperty("resourceId").GetInt32());
        Assert.Equal(25,(await Json(await client.GetAsync("/api/Audit?resourceType=Customer&page=3"))).GetArrayLength());Assert.Equal(100,(await Json(await client.GetAsync("/api/Audit?pageSize=100"))).GetArrayLength());
        var filtered=await Json(await client.GetAsync("/api/Audit?actorId=7&action=Customer.Created&resourceType=Customer&resourceId=10&outcome=Success&from=2026-01-01&to=2026-01-01"));Assert.Single(filtered.EnumerateArray());
        foreach(var query in new[]{"pageSize=101","page=0","actorId=-1","resourceId=-1","from=2026-02-01&to=2026-01-01","outcome=whatever","action="+new string('x',65)})Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync("/api/Audit?"+query)).StatusCode);
    }

    [Theory][InlineData(false)][InlineData(true)]
    public async Task RequiredAuditFailureRollsBackCriticalMutation(bool deletion)
    {
        // The failure must be in the audit append, after a valid capture was staged.
        using var host=new SecurityHost();using var client=await host.SignedIn();var job=await Job(client,await Vehicle(client));var id=job.GetProperty("id").GetInt32();
        await SaveCompany(client);
        var count = Events(host).Count;
        using(var scope=host.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.ExecuteSqlRawAsync("CREATE TRIGGER Reject_Audit BEFORE INSERT ON AuditEvents BEGIN SELECT RAISE(ABORT,'private audit failure detail'); END;");
        var response=deletion?await client.DeleteAsync("/api/ServiceJobs/"+id):await client.PutAsJsonAsync("/api/ServiceJobs/"+id,new {version=job.GetProperty("version").GetString(),description="MUST ROLLBACK",laborCost=999,isCompleted=true});
        Assert.Equal(HttpStatusCode.InternalServerError,response.StatusCode);Assert.DoesNotContain("private audit failure",await response.Content.ReadAsStringAsync());Assert.Equal(count,Events(host).Count);
        var stored=await Json(await client.GetAsync("/api/ServiceJobs/"+id));Assert.Equal("PRIVATE NOTES",stored.GetProperty("description").GetString());Assert.False(stored.GetProperty("isCompleted").GetBoolean());Assert.Single(stored.GetProperty("jobParts").EnumerateArray());
        Assert.Equal("Pending", stored.GetProperty("companyHistory").GetString());
        Assert.Equal(JsonValueKind.Null, stored.GetProperty("companySnapshot").ValueKind);
    }

    [Fact]
    public async Task ConcurrencyAndRelationshipFailuresNeverPersistSuccessEvents()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var job=await Job(client,await Vehicle(client));var count=Events(host).Count;
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync("/api/ServiceJobs/1",new {version="stale",description="Do not save",laborCost=1})).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await client.DeleteAsync("/api/Vehicle/1")).StatusCode);Assert.Equal(count,Events(host).Count);
    }

    [Theory][InlineData("user")][InlineData("settings")][InlineData("logout")]
    public async Task RequiredAuditFailureAlsoRollsBackAccountSettingsAndSqlRevocation(string operation)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();host.AddUser("worker",role:"mechanic");
        var settings=await client.PostAsJsonAsync("/api/Settings",new {hourlyRate=15000,vatRate=27});settings.EnsureSuccessStatusCode();var original=await Json(settings);var count=Events(host).Count;
        using(var scope=host.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.ExecuteSqlRawAsync("CREATE TRIGGER Reject_Audit BEFORE INSERT ON AuditEvents BEGIN SELECT RAISE(ABORT,'audit failure'); END;");
        var response=operation switch {"user"=>await client.DeleteAsync("/api/Users/2"),"settings"=>await client.PostAsJsonAsync("/api/Settings",new {version=original.GetProperty("version").GetString(),hourlyRate=17000,vatRate=0}),_=>await client.PostAsync("/api/Auth/logout",null)};
        Assert.Equal(HttpStatusCode.InternalServerError,response.StatusCode);Assert.Equal(count,Events(host).Count);Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
        using var verify=host.Services.CreateScope();var db=verify.ServiceProvider.GetRequiredService<ApplicationDbContext>();Assert.Equal(2,await db.Users.CountAsync());Assert.Equal(15000,(await db.GlobalSettings.SingleAsync()).HourlyRate);
    }

    [Fact]
    public async Task ProvisionAndLocalRecoveryHaveAtomicSystemEventsWithoutSecrets()
    {
        using var host=new SecurityHost();using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var configuration=new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["InitialAdmin:Email"]="private-operator",["InitialAdmin:Password"]="Provision-secret-123" }).Build();
        InitialAdmin.Provision(db,configuration);TestAdminRecovery.Recover(db,"private-operator","Recovery-secret-123");
        var rows=await db.AuditEvents.OrderBy(e=>e.Id).ToListAsync();Assert.Equal(new[]{"Auth.InitialAdminProvisioned","Auth.LocalAdminRecovered"},rows.Select(e=>e.Action));Assert.All(rows,e=>{Assert.Null(e.ActorUserId);Assert.Equal("system",e.ActorRole);});
        var text=JsonSerializer.Serialize(rows);Assert.DoesNotContain("private-operator",text);Assert.DoesNotContain("Provision-secret",text);Assert.DoesNotContain("Recovery-secret",text);
    }

    [Fact]
    public async Task BoundsAndAppendOnlyGuardAreEnforcedByWriter()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();using var scope=host.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var item=db.Audit.Create("Auth.LoginSucceeded","User",1,resolvedActor:new User{Id=1,Name=new string('x',250)+"\n\r",Role="admin"});Assert.Equal(200,item.ActorName.Length);Assert.DoesNotContain('\n',item.ActorName);
        Assert.Throws<InvalidOperationException>(()=>db.Audit.Create(new string('x',65),"User",1));Assert.Throws<InvalidOperationException>(()=>db.Audit.Create("Auth.LoginSucceeded","User",1,new string('x',2049)));
        var saved=await db.AuditEvents.FirstAsync();db.AuditEvents.Remove(saved);await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
    }

    [Fact]
    public async Task UpgradeFromStage3DOnlyAddsAuditTableAndPreservesData()
    {
        await using var connection=new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:");await connection.OpenAsync();await using var db=new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261029000200_IntegrityGuards");await db.Database.ExecuteSqlRawAsync("INSERT INTO Customers (Name,PhoneNumber) VALUES ('Preserve','123');");await db.Database.MigrateAsync();Assert.Equal("Preserve",(await db.Customers.SingleAsync()).Name);Assert.Empty(db.AuditEvents);Assert.False(db.Database.HasPendingModelChanges());
    }
}
