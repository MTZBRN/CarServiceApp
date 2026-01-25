using CarServiceShop.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Adatbázis bekötése
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Controller-ek engedélyezése 
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173") // A React alapértelmezett portja
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
    options.AddPolicy("AllowDockerFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:8080") // A Docker alapértelmezett portja
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});


// 3. Swagger generátor beállítása (Swashbuckle)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); 

var app = builder.Build();

// 4. Swagger bekapcsolása (Swashbuckle)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger(); // Generálja a JSON-t
    app.UseSwaggerUI(); // Generálja a kék-fehér weboldalt
}

app.UseHttpsRedirection();

// 5. A végpontok térképezése
app.MapControllers();
app.UseCors("AllowDockerFrontend");
app.UseCors("AllowReactApp");
app.Run();