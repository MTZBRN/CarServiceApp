using CarServiceShop.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer; 
using Microsoft.IdentityModel.Tokens;               
using System.Text;                                  

var builder = WebApplication.CreateBuilder(args);

// --- 1. JWT KONFIGURÁCIÓ ---
var jwtKey = builder.Configuration["Jwt:Key"]; 
if (string.IsNullOrEmpty(jwtKey)) throw new Exception("JWT kulcs hiányzik!");
var key = Encoding.ASCII.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// --- 2. ADATBÁZIS ÉS KÖZÖS SZOLGÁLTATÁSOK ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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

var app = builder.Build();

// --- 3. SEED ÉS ADATBÁZIS INICIALIZÁLÁS ---
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        DbSeeder.SeedUsers(context);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Hiba a seedelés közben: {ex.Message}");
    }
}

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
var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
if (!Directory.Exists(uploadPath)) Directory.CreateDirectory(uploadPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadPath),
    RequestPath = "/uploads"
});

app.UseAuthentication(); 
app.UseAuthorization();  

app.MapControllers();

// ✅ ÚJ: Ha a felhasználó pl. a /customers url-re megy, a C# nem tudja mi az, 
// ezért visszaadja a React alkalmazást, és a React Router majd megoldja!
app.MapFallbackToFile("index.html");

app.Run();