using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CarServiceShop.Controllers;
[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto loginDto)
    {
        // 1. Felhasználó keresése az adatbázisban email alapján
        var user = _context.Users.FirstOrDefault(u => u.Email == loginDto.Email);
    
        if (user == null) return Unauthorized(new { message = "Hibás felhasználónév!" });

        // 2. Jelszó ellenőrzése a BCrypt segítségével
        bool isPasswordValid = BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash);
    
        if (!isPasswordValid) return Unauthorized(new { message = "Hibás jelszó!" });

        // 3. JWT TOKEN GENERÁLÁSA (Ide kerül az új rész)
        var tokenHandler = new JwtSecurityTokenHandler();
    
        // Kiolvassuk a kulcsot az appsettings.json-ból (amit az előbb beszéltünk meg)
        var keyString = _configuration["Jwt:Key"];
        if (string.IsNullOrEmpty(keyString)) return StatusCode(500, "Szerver hiba: JWT kulcs hiányzik!");
    
        var key = Encoding.ASCII.GetBytes(keyString);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[] 
            { 
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Role, user.Role)
            }),
            Expires = DateTime.UtcNow.AddDays(7), // 7 napig érvényes
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key), 
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        // 4. Visszaküldjük a generált tokent és a felhasználó adatait
        return Ok(new { 
            Token = tokenString, 
            UserName = user.Name,
            Role = user.Role
        });
    }
}

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}