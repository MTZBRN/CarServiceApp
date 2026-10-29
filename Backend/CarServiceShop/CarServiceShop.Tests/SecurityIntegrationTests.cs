using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using CarServiceShop.Data;
using CarServiceShop.Models;
using CarServiceShop.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SkiaSharp;
using Microsoft.Extensions.Logging;

namespace CarServiceShop.Tests;

public sealed class SecurityHost : WebApplicationFactory<Program>
{
    public const string Issuer="urn:carserviceapp:security-tests:issuer";
    public const string Audience="urn:carserviceapp:security-tests:client";
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "car-security-" + Guid.NewGuid().ToString("N"));
    public string Key { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    public LogCapture Logs { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(Root);
        Directory.CreateDirectory(Path.Combine(Root,"wwwroot"));
        File.WriteAllText(Path.Combine(Root,"wwwroot","index.html"),"<!doctype html><title>Security test document</title>");
        builder.UseWebRoot(Path.Combine(Root,"wwwroot"));
        builder.UseEnvironment("Production");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string,string?> {
            ["Jwt:Key"] = Key, ["Jwt:Issuer"]=Issuer, ["Jwt:Audience"]=Audience, ["ConnectionStrings:DefaultConnection"] = "Data Source=" + Path.Combine(Root,"test.db"),
            ["Uploads:Path"] = Path.Combine(Root,"uploads")
        }));
    }
    public HttpClient Client() => CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
    public void AddUser(string email = "owner", string password = "Synthetic-password-123", string role = "admin")
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Users.Add(new User { Name="Test", Email=email, Role=role, PasswordHash=BCrypt.Net.BCrypt.HashPassword(password) }); db.SaveChanges();
    }
    public async Task<HttpClient> SignedIn()
    {
        AddUser(); var client=Client();
        var response=await client.PostAsJsonAsync("/api/Auth/login",new {email="owner", password="Synthetic-password-123"});
        response.EnsureSuccessStatusCode();
        var body=await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",body.GetProperty("token").GetString());
        return client;
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(Root)) Directory.Delete(Root,true);
    }
}

public sealed class LogCapture : ILoggerProvider
{
    public System.Collections.Concurrent.ConcurrentQueue<string> Messages { get; } = new();
    public ILogger CreateLogger(string name) => new Capture(Messages);
    public void Dispose() { }
    private sealed class Capture(System.Collections.Concurrent.ConcurrentQueue<string> messages) : ILogger {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? error, Func<TState,Exception?,string> formatter) => messages.Enqueue(formatter(state,error));
    }
}

public class SecurityIntegrationTests
{
    [Theory]
    [InlineData(null)] [InlineData("")] [InlineData("changeme")] [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public void InvalidSigningKeyFails(string? key) => Assert.Throws<InvalidOperationException>(() => SecurityRules.SigningKey(key));

    [Fact]
    public void MissingKeyFailsActualStartup()
    {
        using var host=new SecurityHost();
        using var broken=host.WithWebHostBuilder(b=>b.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(new Dictionary<string,string?> { ["Jwt:Key"]="" })));
        Assert.Throws<InvalidOperationException>(()=>broken.CreateClient());
    }

    [Fact]
    public async Task FreshProductionHasNoDefaultAccount_ProvisionIsExplicitAndNeverOverwrites()
    {
        using var host=new SecurityHost(); using var client=host.Client();
        using var scope=host.Services.CreateScope(); var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Empty(db.Users);
        Assert.Throws<InvalidOperationException>(()=>InitialAdmin.Provision(db,new ConfigurationBuilder().Build()));
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["InitialAdmin:Email"]="initial",["InitialAdmin:Password"]="Initial-only-password-123" }).Build();
        InitialAdmin.Provision(db,config); var hash=db.Users.Single().PasswordHash;
        InitialAdmin.Provision(db,new ConfigurationBuilder().Build());
        Assert.Equal(hash,db.Users.Single().PasswordHash); Assert.Equal("initial",db.Users.Single().Email);
        Assert.Equal(HttpStatusCode.OK,(await client.PostAsJsonAsync("/api/Auth/login",new {email="initial",password="Initial-only-password-123"})).StatusCode);
        Assert.DoesNotContain(host.Logs.Messages, message => message.Contains("Initial-only-password-123") || message.Contains("alapértelmezett admin", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ConfiguredKeyWorks_UnrelatedAndExpiredTokensFail_AuthorizationRemains()
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn();
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/Auth/me")).StatusCode);
        foreach(var wrongKey in new[]{true,false}) {
            var token=new JwtSecurityTokenHandler().CreateToken(new SecurityTokenDescriptor {
                Issuer=SecurityHost.Issuer,Audience=SecurityHost.Audience,
                Subject=new ClaimsIdentity(new[]{new Claim(ClaimTypes.NameIdentifier,"1"),new Claim(ClaimTypes.Role,"admin"),new Claim("session_version","initial")}),
                NotBefore=DateTime.UtcNow.AddHours(-2), Expires=wrongKey?DateTime.UtcNow.AddHours(1):DateTime.UtcNow.AddHours(-1),
                SigningCredentials=new SigningCredentials(new SymmetricSecurityKey(wrongKey?RandomNumberGenerator.GetBytes(48):Convert.FromBase64String(host.Key)),SecurityAlgorithms.HmacSha256)
            });
            client.DefaultRequestHeaders.Authorization=new("Bearer",new JwtSecurityTokenHandler().WriteToken(token));
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Auth/me")).StatusCode);
        }
        client.DefaultRequestHeaders.Authorization=null;
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/api/Customers")).StatusCode);
        host.AddUser("mechanic",role:"mechanic");
        var login=await client.PostAsJsonAsync("/api/Auth/login",new {email="mechanic",password="Synthetic-password-123"});
        var json=await login.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        client.DefaultRequestHeaders.Authorization=new("Bearer",json.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden,(await client.GetAsync("/api/Users")).StatusCode);
    }

    [Fact]
    public async Task LoginFailuresAreUniformAndThrottled_AnotherAccountStillWorks()
    {
        using var host=new SecurityHost(); host.AddUser(); using var client=host.Client();
        var unknown=await client.PostAsJsonAsync("/api/Auth/login",new {email="missing",password="incorrect"});
        var wrong=await client.PostAsJsonAsync("/api/Auth/login",new {email="owner",password="incorrect"});
        Assert.Equal(unknown.StatusCode,wrong.StatusCode); Assert.Equal(await unknown.Content.ReadAsStringAsync(),await wrong.Content.ReadAsStringAsync());
        for(int i=0;i<11;i++) wrong=await client.PostAsJsonAsync("/api/Auth/login",new {email="missing",password="incorrect"});
        Assert.Equal((HttpStatusCode)429,wrong.StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await client.PostAsJsonAsync("/api/Auth/login",new {email="owner",password="Synthetic-password-123"})).StatusCode);
        for(int i=0;i<31;i++) wrong=await client.PostAsJsonAsync("/api/Auth/login",new {email="other"+i,password="incorrect"});
        Assert.Equal((HttpStatusCode)429,wrong.StatusCode);
    }

    [Theory]
    [InlineData("")] [InlineData("short")] [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    [InlineData("ééééééééééééééééééééééééééééééééééééé")]
    public async Task PasswordPolicyEnforcedOnBothHttpWrites(string password)
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn();
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/Users",new {name="Bad",email="bad",password,role="mechanic"})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/Auth/change-password",new {oldPassword="Synthetic-password-123",newPassword=password})).StatusCode);
    }

    [Fact]
    public void Utf8Boundary() { Assert.True(SecurityRules.ValidPassword(new string('é',36))); Assert.False(SecurityRules.ValidPassword(new string('é',37))); }

    [Fact]
    public async Task OversizedDimensionsAreRejected_ArbitraryDeletionIsImpossible()
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn();
        using var bitmap=new SKBitmap(2049,1); using var image=SKImage.FromBitmap(bitmap); using var encoded=image.Encode(SKEncodedImageFormat.Png,100);
        Assert.Equal(HttpStatusCode.BadRequest,(await Upload(client,encoded.ToArray())).StatusCode);
        var service=host.Services.GetRequiredService<ProfileImages>();
        var outside=Path.Combine(host.Root,"keep.png"); File.WriteAllText(outside,"keep");
        service.DeleteOwned(1,"../keep.png"); service.DeleteOwned(1,"profile_2_other.png");
        Assert.True(File.Exists(outside));
    }

    public static byte[] Picture(SKEncodedImageFormat format=SKEncodedImageFormat.Png) {
        using var bitmap=new SKBitmap(2,2); bitmap.Erase(SKColors.Blue); using var image=SKImage.FromBitmap(bitmap); using var data=image.Encode(format,90); return data.ToArray();
    }
    private static async Task<HttpResponseMessage> Upload(HttpClient client, byte[] data, string name="photo.png", string mime="image/png") {
        using var form=new MultipartFormDataContent(); var part=new ByteArrayContent(data); part.Headers.ContentType=new MediaTypeHeaderValue(mime); form.Add(part,"file",name);
        return await client.PostAsync("/api/Auth/upload-profile-picture",form);
    }

    [Fact]
    public async Task UploadRejectsActiveMalformedOversizedAndMisleadingContent()
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn();
        foreach(var bytes in new[]{Array.Empty<byte>(), "<html>test</html>"u8.ToArray(),"<svg xmlns='http://www.w3.org/2000/svg'/>"u8.ToArray(),"alert(1)"u8.ToArray(),Picture()[..30]})
            Assert.Equal(HttpStatusCode.BadRequest,(await Upload(client,bytes)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Upload(client,Picture(),mime:"text/html")).StatusCode);
        var tooBig=await Upload(client,new byte[ProfileImages.MaxBytes+1]); Assert.True(tooBig.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge);
        Assert.Empty(Directory.GetFiles(Path.Combine(host.Root,"uploads")));
        File.WriteAllText(Path.Combine(host.Root,"uploads","old.html"),"test");
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync("/uploads/old.html")).StatusCode);
    }

    [Fact]
    public async Task RasterReplacementIsCanonicalAndCleansPreviousOwnedFile()
    {
        using var host=new SecurityHost(); using var client=await host.SignedIn(); string? previous=null;
        foreach(var format in new[]{SKEncodedImageFormat.Png,SKEncodedImageFormat.Jpeg}) {
            var response=await Upload(client,Picture(format),"../../anything.html",format==SKEncodedImageFormat.Png?"image/png":"image/jpeg"); response.EnsureSuccessStatusCode();
            var json=await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(); var path=json.GetProperty("filePath").GetString()!;
            Assert.Matches(@"^/uploads/profile_1_[a-f0-9]{32}\.png$",path);
            var served=await client.GetAsync(path); Assert.Equal("image/png",served.Content.Headers.ContentType!.MediaType);
            Assert.Equal("nosniff",served.Headers.GetValues("X-Content-Type-Options").Single());
            Assert.Equal("default-src 'none'; sandbox",served.Headers.GetValues("Content-Security-Policy").Single());
            if(previous!=null) Assert.False(File.Exists(Path.Combine(host.Root,"uploads",previous)));
            previous=Path.GetFileName(path);
        }
        Assert.Single(Directory.GetFiles(Path.Combine(host.Root,"uploads")));
    }

    [Fact]
    public async Task TrustedProxySchemeIsApplied_UntrustedHeadersAreIgnored()
    {
        using var host=new SecurityHost(); using var client=host.Client();
        var options=host.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>>().Value;
        foreach(var trusted in new[]{true,false}) {
            var context=new Microsoft.AspNetCore.Http.DefaultHttpContext();
            context.Connection.RemoteIpAddress=trusted?IPAddress.IPv6Loopback:IPAddress.Parse("198.51.100.4");
            context.Request.Scheme="http";
            context.Request.Headers["X-Forwarded-Proto"]="https";
            context.Request.Headers["X-Forwarded-For"]="203.0.113.9";
            var middleware=new Microsoft.AspNetCore.HttpOverrides.ForwardedHeadersMiddleware(
                _=>Task.CompletedTask, Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance,
                Microsoft.Extensions.Options.Options.Create(options));
            await middleware.Invoke(context);
            Assert.Equal(trusted?"https":"http",context.Request.Scheme);
            Assert.Equal(trusted?"203.0.113.9":"198.51.100.4",context.Connection.RemoteIpAddress!.ToString());
        }
        Assert.Equal(1,options.ForwardLimit);
    }
}
