using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Authorization;
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

    [AllowAnonymous]
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
            Role = user.Role,
            ProfilePicturePath = user.ProfilePicturePath
        });
    }
    
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _context.Users.FindAsync(id);
        if (user == null) return Unauthorized();
        return Ok(new { userName = user.Name, user.Role, user.ProfilePicturePath });
    }
    [Authorize] // Bárki, aki be van jelentkezve, használhatja
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        // 1. Kikeressük a júzert a Tokenben lévő ID alapján
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return Unauthorized();

        var user = await _context.Users.FindAsync(int.Parse(userIdClaim.Value));
        if (user == null) return NotFound(new { message = "Felhasználó nem található!" });

        // 2. Régi jelszó ellenőrzése
        if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "A jelenlegi jelszó nem megfelelő!" });
        }

        // 3. Új jelszó hashelése és mentése
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Jelszó sikeresen megváltoztatva!" });
    }
    
    [Authorize]
    [HttpPost("upload-profile-picture")]
    public async Task<IActionResult> UploadProfilePicture(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("Nincs fájl kiválasztva.");

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        // Fájlnév generálás (pl. user_1_12345.jpg), hogy ne legyenek ütközések
        var extension = Path.GetExtension(file.FileName);
        var fileName = $"profile_{userId}_{DateTime.Now.Ticks}{extension}";
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "uploads", fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Elmentjük az adatbázisba az elérési utat
        user.ProfilePicturePath = fileName;
        await _context.SaveChangesAsync();

        return Ok(new { filePath = $"/uploads/{fileName}" });
    }
}

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}