using CarServiceShop.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer; 
using Microsoft.IdentityModel.Tokens;               // ✅ Új
using System.Text;                                  // ✅ Új

var builder = WebApplication.CreateBuilder(args);

// --- 1. JWT KONFIGURÁCIÓ (builder.Build előtt) ---
// Fontos: A kulcs legalább 32 karakter hosszú legyen!
var jwtKey = builder.Configuration["Jwt:Key"]; // Kiolvassa az appsettings-ből
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
        context.Database.Migrate();
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

// 1. CORS legyen az első
app.UseCors("AllowAll");

// 2. Hitelesítés (Ki vagy te?)
app.UseAuthentication(); 

// 3. Engedélyezés (Mit tehetsz?)
app.UseAuthorization();  

// 4. Végpontok
app.MapControllers();

app.Run();