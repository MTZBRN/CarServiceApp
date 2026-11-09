using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using CarServiceShop.Data;
using CarServiceShop.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace CarServiceShop.Tests;

// Discovered only when a test explicitly adds this assembly to its local host.
[ApiController, Route("__test/fault"), AllowAnonymous]
public class FaultProbeController : ControllerBase
{
    [HttpGet("{kind}")]
    public IActionResult Fault(string kind) => throw (kind=="db"
        ? new Microsoft.Data.Sqlite.SqliteException("private-credential-and-SQL-marker",1)
        : new InvalidOperationException("private-credential-and-SQL-marker"));
}

public class Stage3ATests
{
    private static void Scope(IWebHostBuilder b,string field,string? value) => b.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(new Dictionary<string,string?>{["Jwt:"+field]=value}));
    [Theory]
    [InlineData("Issuer",null)] [InlineData("Audience",null)] [InlineData("Issuer","")] [InlineData("Audience"," ")]
    [InlineData("Issuer","https://example.com")] [InlineData("Audience","urn:default:client")]
    [InlineData("Issuer",ProductionHardening.DevelopmentIssuer)] [InlineData("Audience",ProductionHardening.DevelopmentAudience)]
    public void InvalidScopePreventsProductionStartup(string field,string? value)
    {
        using var host=new SecurityHost();using var bad=host.WithWebHostBuilder(b=>Scope(b,field,value));
        var error=Assert.Throws<InvalidOperationException>(()=>bad.CreateClient());Assert.Contains("Jwt:"+field,error.Message);
    }
    [Fact]
    public void MigrationFailurePreventsServing()
    {
        using var host=new SecurityHost();
        using var broken=host.WithWebHostBuilder(b=>b.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(new Dictionary<string,string?>{["ConnectionStrings:DefaultConnection"]="Data Source="+host.Root})));
        Assert.Throws<Microsoft.Data.Sqlite.SqliteException>(()=>broken.CreateClient());
    }
    [Fact]
    public async Task ProductionSeedIsRemovedAndNeverMutates_DevAdminStillWorks()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        Assert.Equal(HttpStatusCode.NotFound,(await client.PostAsync("/api/Seed",null)).StatusCode);
        client.DefaultRequestHeaders.Add("X-Environment","Development");
        Assert.Equal(HttpStatusCode.NotFound,(await client.PostAsync("/api/Seed?environment=Development",null)).StatusCode);
        var feature=new ControllerFeature();host.Services.GetRequiredService<Microsoft.AspNetCore.Mvc.ApplicationParts.ApplicationPartManager>().PopulateFeature(feature);
        Assert.DoesNotContain(feature.Controllers,t=>t.AsType()==typeof(CarServiceShop.Controllers.SeedController));
        using(var scope=host.Services.CreateScope()) Assert.Empty(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Customers);
        using var dev=host.WithWebHostBuilder(b=>b.UseEnvironment("Development"));using var devClient=dev.CreateClient(new(){BaseAddress=new Uri("https://localhost")});
        var login=await devClient.PostAsJsonAsync("/api/Auth/login",new{email="owner",password="Synthetic-password-123"});login.EnsureSuccessStatusCode();
        var body=await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();devClient.DefaultRequestHeaders.Authorization=new("Bearer",body.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK,(await devClient.PostAsync("/api/Seed",null)).StatusCode);
        devClient.DefaultRequestHeaders.Authorization=null;Assert.Equal(HttpStatusCode.Unauthorized,(await devClient.PostAsync("/api/Seed",null)).StatusCode);
        host.AddUser("mechanic",role:"mechanic");var mechanic=await devClient.PostAsJsonAsync("/api/Auth/login",new{email="mechanic",password="Synthetic-password-123"});
        var m=await mechanic.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();devClient.DefaultRequestHeaders.Authorization=new("Bearer",m.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden,(await devClient.PostAsync("/api/Seed",null)).StatusCode);
    }
    [Fact]
    public async Task ExpectedClientStatusCodesRemainUnchanged()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/Customers",new{name="",phoneNumber=""})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync("/api/Customers/99999")).StatusCode);
        var c=await client.PostAsJsonAsync("/api/Customers",new{name="Guarded",phoneNumber="123"});c.EnsureSuccessStatusCode();
        var data=await c.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();var id=data.GetProperty("id").GetInt32();
        (await client.PostAsJsonAsync("/api/Vehicle",new{customerId=id,licensePlate="GUARD",make="Ford",model="Focus",year=2020})).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict,(await client.DeleteAsync("/api/Customers/"+id)).StatusCode);
        client.DefaultRequestHeaders.Authorization=null;Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
        host.AddUser("mechanic",role:"mechanic");var login=await client.PostAsJsonAsync("/api/Auth/login",new{email="mechanic",password="Synthetic-password-123"});login.EnsureSuccessStatusCode();
        var token=await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();client.DefaultRequestHeaders.Authorization=new("Bearer",token.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden,(await client.GetAsync("/api/Users")).StatusCode);
    }
    [Fact]
    public void NginxStaticDocumentPolicyMatchesTestedBackendPolicy()
    {
        using var host=new SecurityHost();using var client=host.Client();
        var contentRoot=host.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>().ContentRootPath;
        var repository=Directory.GetParent(contentRoot)!.Parent!.Parent!.FullName;
        var policy=File.ReadAllText(Path.Combine(repository,"Frontend","security-headers.conf"));
        Assert.Contains("\""+ProductionHardening.ProductionCsp+"\"",policy);
        Assert.Contains("add_header X-Frame-Options \"DENY\" always",policy);
        Assert.Contains("$frontend_hsts",policy);
    }
    [Theory] [InlineData("Production","http://localhost:5173",false)] [InlineData("Production","https://evil.invalid",false)]
    [InlineData("Development","http://localhost:5173",true)] [InlineData("Development","http://127.0.0.1:5173",true)] [InlineData("Development","https://evil.invalid",false)]
    public async Task CorsUsesOnlyExplicitDevOrigins(string environment,string origin,bool allowed)
    {
        using var host=new SecurityHost();using var configured=host.WithWebHostBuilder(b=>b.UseEnvironment(environment));using var client=configured.CreateClient(new(){BaseAddress=new Uri("https://localhost")});
        using var preflight=new HttpRequestMessage(HttpMethod.Options,"/api/Customers");preflight.Headers.Add("Origin",origin);preflight.Headers.Add("Access-Control-Request-Method","GET");preflight.Headers.Add("Access-Control-Request-Headers","authorization");
        var response=await client.SendAsync(preflight);Assert.Equal(allowed,response.Headers.Contains("Access-Control-Allow-Origin"));
        if(allowed)Assert.Equal(origin,response.Headers.GetValues("Access-Control-Allow-Origin").Single());Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
        client.DefaultRequestHeaders.Add("Origin",origin);Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Customers")).StatusCode);
    }
    [Fact]
    public async Task HeadersCoverDocumentsAuthErrorsAndUploads_HstsOnlyWithHttps()
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();
        var document=await client.GetAsync("/");Assert.Equal(HttpStatusCode.OK,document.StatusCode);
        foreach(var response in new[]{document,await client.GetAsync("/api/Auth/me")}) {
            Assert.Equal(ProductionHardening.ProductionCsp,response.Headers.GetValues("Content-Security-Policy").Single());
            Assert.Equal("DENY",response.Headers.GetValues("X-Frame-Options").Single());Assert.Equal("nosniff",response.Headers.GetValues("X-Content-Type-Options").Single());
            Assert.Equal("no-referrer",response.Headers.GetValues("Referrer-Policy").Single());Assert.Contains("camera=()",response.Headers.GetValues("Permissions-Policy").Single());
        }
        var api=await client.GetAsync("/api/Auth/me");Assert.True(api.Headers.CacheControl!.NoStore);
        client.DefaultRequestHeaders.Authorization=null;Assert.True((await client.GetAsync("/api/Auth/me")).Headers.CacheControl!.NoStore);
        using var https=host.CreateClient(new(){BaseAddress=new Uri("https://workshop.invalid"),AllowAutoRedirect=false});
        Assert.Contains("max-age=15552000",(await https.GetAsync("/")).Headers.GetValues("Strict-Transport-Security").Single());
        using var http=host.CreateClient(new(){BaseAddress=new Uri("http://workshop.invalid"),AllowAutoRedirect=false});Assert.False((await http.GetAsync("/")).Headers.Contains("Strict-Transport-Security"));
    }
    [Theory] [InlineData("Production","db")] [InlineData("Production","unexpected")] [InlineData("Development","unexpected")]
    public async Task UnexpectedErrorsAreSanitizedAndSensitiveMessagesNotLogged(string env,string kind)
    {
        using var host=new SecurityHost();using var configured=host.WithWebHostBuilder(b=>{b.UseEnvironment(env);b.ConfigureServices(s=>s.AddControllers().AddApplicationPart(typeof(FaultProbeController).Assembly));});
        using var client=configured.CreateClient(new(){BaseAddress=new Uri("https://localhost")});var response=await client.GetAsync("/__test/fault/"+kind);
        Assert.Equal(HttpStatusCode.InternalServerError,response.StatusCode);Assert.Equal("application/problem+json",response.Content.Headers.ContentType!.MediaType);
        var body=await response.Content.ReadAsStringAsync();Assert.DoesNotContain("marker",body);Assert.DoesNotContain("Sqlite",body);Assert.DoesNotContain("Exception",body);Assert.DoesNotContain("Stack",body);
        Assert.Contains("traceId",body);Assert.True(response.Headers.CacheControl!.NoStore);Assert.True(response.Headers.Contains("Content-Security-Policy"));
        Assert.DoesNotContain(host.Logs.Messages,m=>m.Contains("private-credential-and-SQL-marker"));
    }
    [Theory] [InlineData("valid")] [InlineData("legacy")] [InlineData("issuer")] [InlineData("audience")] [InlineData("unsigned")]
    [InlineData("algorithm")] [InlineData("expired")] [InlineData("retired-key")] [InlineData("stale-session")] [InlineData("no-expiry")]
    public async Task JwtScopeAndAlgorithmAreEnforced(string variant)
    {
        using var host=new SecurityHost();using var client=await host.SignedIn();var key=variant=="retired-key"?RandomNumberGenerator.GetBytes(48):Convert.FromBase64String(host.Key);
        var claims=new List<Claim>{new(ClaimTypes.NameIdentifier,"1"),new(ClaimTypes.Role,"admin"),new("session_version",variant=="stale-session"?"old":"initial")};
        if (variant != "legacy") claims.Add(new JwtSecurityTokenHandler().ReadJwtToken(client.DefaultRequestHeaders.Authorization!.Parameter)
            .Claims.Single(c => c.Type == CarServiceShop.Security.WorkshopSession.Claim));
        var credentials=variant=="unsigned"?null:new SigningCredentials(new SymmetricSecurityKey(key),variant=="algorithm"?SecurityAlgorithms.HmacSha384:SecurityAlgorithms.HmacSha256);
        var token=new JwtSecurityToken(variant=="issuer"?"urn:other:issuer":SecurityHost.Issuer,variant=="audience"?"urn:other:client":SecurityHost.Audience,claims,
            DateTime.UtcNow.AddHours(-2),variant=="no-expiry"?null:DateTime.UtcNow.AddHours(variant=="expired"?-1:1),credentials);
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",new JwtSecurityTokenHandler().WriteToken(token));
        Assert.Equal(variant=="valid"?HttpStatusCode.OK:HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
    }
}
