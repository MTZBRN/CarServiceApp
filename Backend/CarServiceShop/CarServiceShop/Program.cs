using CarServiceShop.Security;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using CarServiceShop.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer; 
using Microsoft.IdentityModel.Tokens;               
using System.Text;                                  

var builder = WebApplication.CreateBuilder(args);

// Explicit development-only offline recovery: no HTTP listener and no signing key required.
var recoveryIndex = Array.IndexOf(args, "--recover-test-admin");
if (recoveryIndex >= 0)
{
    if (!builder.Environment.IsDevelopment()) throw new InvalidOperationException("Test recovery is available only in Development.");
    if (recoveryIndex + 1 >= args.Length || args[recoveryIndex + 1].StartsWith("--"))
        throw new InvalidOperationException("Usage: --recover-test-admin <existing username>");
    var connection = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(builder.Configuration.GetConnectionString("DefaultConnection"));
    connection.DataSource = Path.GetFullPath(connection.DataSource, builder.Environment.ContentRootPath);
    if (!File.Exists(connection.DataSource)) throw new InvalidOperationException("Existing database not found; recovery does not create databases.");
    Console.WriteLine($"Test account recovery in: {connection.DataSource}");
    var password = TestAdminRecovery.ReadPassword("New password (12+ characters, at most 72 UTF-8 bytes; input hidden): ");
    var confirmation = TestAdminRecovery.ReadPassword("Confirm password: ");
    if (password != confirmation) throw new InvalidOperationException("Passwords do not match. Nothing changed.");
    if (!SecurityRules.ValidPassword(password)) throw new InvalidOperationException(SecurityRules.PasswordMessage);
    using var recoveryDb = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection.ConnectionString).Options);
    recoveryDb.Database.Migrate();
    TestAdminRecovery.Recover(recoveryDb, args[recoveryIndex + 1], password);
    Console.WriteLine("Administrator recovered. Existing sessions revoked. Start the application normally to sign in.");
    return;
}

// --- 1. JWT KONFIGURÁCIÓ ---

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.Events = new JwtBearerEvents { OnTokenValidated = async ctx => {
        var db = ctx.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var id = ctx.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var role = ctx.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var version = ctx.Principal?.FindFirst("session_version")?.Value;
        if (string.IsNullOrEmpty(version) || !int.TryParse(id, out var userId) || !await db.Users.AnyAsync(u => u.Id == userId && u.Role == role && u.SessionVersion == version)) ctx.Fail("Invalid session");
    }};
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,

        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<IConfiguration>((options, config) => {
    options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(SecurityRules.SigningKey(config["Jwt:Key"]));
});
// --- 2. ADATBÁZIS ÉS KÖZÖS SZOLGÁLTATÁSOK ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddAuthorization(o => o.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); 

builder.Services.AddSingleton<ProfileImages>();
builder.Services.Configure<ForwardedHeadersOptions>(options => {
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    // Never clear trust lists or trust arbitrary forwarding headers.
    foreach (var address in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
        options.KnownProxies.Add(System.Net.IPAddress.Parse(address));
});
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions {
            PermitLimit = Math.Clamp(builder.Configuration.GetValue("Login:SourcePermitLimit", 30), 1, 1000), Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
        }));
});
builder.Services.AddSingleton<LoginThrottle>();
var app = builder.Build();
_ = SecurityRules.SigningKey(app.Configuration["Jwt:Key"]);

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate();
    if (args.Contains("--provision-admin"))
    {
        InitialAdmin.Provision(context, builder.Configuration);
        return;
    }
}

app.UseForwardedHeaders();
app.UseRouting();
app.UseRateLimiter();
// --- 4. MIDDLEWARE SORREND (Kritikus!) ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");

// ✅ ÚJ: Ezek kellenek a React kiszolgálásához!
app.UseDefaultFiles(); // Megkeresi az index.html-t a wwwroot-ban
app.UseStaticFiles();  // Kiszolgálja a React fájlokat (js, css, képek)

// Egyedi mappa a feltöltéseknek (profilképek)
var images = app.Services.GetRequiredService<ProfileImages>();
Directory.CreateDirectory(images.DirectoryPath);
// Only canonical server-generated PNGs and legacy raster names are public. Old active files stay unreachable.
app.Use(async (ctx, next) => {
    if (ctx.Request.Path.StartsWithSegments("/uploads", out var name)) {
        if (!System.Text.RegularExpressions.Regex.IsMatch(name.Value ?? "", @"^/profile_\d+_[a-zA-Z0-9]+\.(png|jpg|jpeg)$")) { ctx.Response.StatusCode = 404; return; }
        ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
        ctx.Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
    }
    await next();
});
app.UseStaticFiles(new StaticFileOptions {
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(images.DirectoryPath), RequestPath = "/uploads"
});
app.UseAuthentication(); 
app.UseAuthorization();  

app.MapControllers();

// ✅ ÚJ: Ha a felhasználó pl. a /customers url-re megy, a C# nem tudja mi az, 
// ezért visszaadja a React alkalmazást, és a React Router majd megoldja!
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
public partial class Program { }
