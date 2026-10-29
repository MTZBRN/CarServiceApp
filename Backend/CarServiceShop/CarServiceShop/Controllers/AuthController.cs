using CarServiceShop.Security;
using Microsoft.AspNetCore.RateLimiting;
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
    [EnableRateLimiting("login")]
    [RequestSizeLimit(4096)]
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginDto loginDto, [FromServices] LoginThrottle throttle)
    {
        if (loginDto.Email.Length > 254 || System.Text.Encoding.UTF8.GetByteCount(loginDto.Password) > 72)
            return Unauthorized(new { message = "Hibás bejelentkezési adatok!" });
        if (!throttle.Enter(loginDto.Email)) return StatusCode(429);
        User? user;
        bool valid = false;
        try {
            var normalized = Integrity.NormalizeLogin(loginDto.Email);
            user = _context.Users.FirstOrDefault(u => u.NormalizedLogin == normalized);
            valid = BCrypt.Net.BCrypt.Verify(loginDto.Password, user?.PasswordHash ?? SecurityRules.DummyHash);
        } finally { throttle.Exit(loginDto.Email, valid); }
        if (user == null || !valid) return Unauthorized(new { message = "Hibás bejelentkezési adatok!" });
        var tokenString = IssueToken(user);

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
        if (!SecurityRules.ValidPassword(dto.NewPassword) || Encoding.UTF8.GetByteCount(dto.OldPassword) > 72) return BadRequest(new { message = SecurityRules.PasswordMessage });
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
        user.SessionVersion = Guid.NewGuid().ToString("N");
        await _context.SaveChangesAsync();

        return Ok(new { message = "Jelszó sikeresen megváltoztatva!", token = IssueToken(user) });
    }

    // Logout revokes all access tokens for this identity, never a supplied user ID.
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        // SQL assignment avoids lost invalidation under simultaneous password/logout requests.
        var version = Guid.NewGuid().ToString("N");
        await _context.Users.Where(u=>u.Id==id).ExecuteUpdateAsync(s=>s.SetProperty(u=>u.SessionVersion,version));
        return NoContent();
    }

    private string IssueToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = SecurityRules.SigningKey(_configuration["Jwt:Key"]);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("session_version", user.SessionVersion)
            }),
            Issuer = ProductionHardening.JwtScope(_configuration,"Issuer",HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()),
            Audience = ProductionHardening.JwtScope(_configuration,"Audience",HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()),
            Expires = DateTime.UtcNow.AddDays(7), // 7 napig érvényes
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return tokenString;
    }

    [Authorize]
    [HttpPost("upload-profile-picture")]
    [RequestSizeLimit(ProfileImages.MaxBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = ProfileImages.MaxBytes + 65536)]
    public async Task<IActionResult> UploadProfilePicture(IFormFile file, [FromServices] ProfileImages images)
    {
        if (file == null || file.Length == 0 || file.Length > ProfileImages.MaxBytes) return BadRequest("PNG/JPEG kép szükséges, legfeljebb 2 MiB.");
        // MIME/filename never decide the output type. Only a successful raster decode is accepted.
        if (file.ContentType is not ("image/png" or "image/jpeg")) return BadRequest("Érvénytelen képtípus.");
        using var ownedLock = await images.LockAsync();
        using var input = new MemoryStream();
        await file.CopyToAsync(input);
        var normalized = ProfileImages.Normalize(input.ToArray());
        if (normalized == null) return BadRequest("Érvénytelen PNG/JPEG kép (maximum 2048 × 2048).");
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();
        var previous = user.ProfilePicturePath;
        var name = $"profile_{userId}_{Guid.NewGuid():N}.png";
        Directory.CreateDirectory(images.DirectoryPath);
        var target = Path.Combine(images.DirectoryPath, name);
        try {
            await using (var stream = new FileStream(target, FileMode.CreateNew)) await stream.WriteAsync(normalized);
            user.ProfilePicturePath = name;
            await _context.SaveChangesAsync();
        } catch { System.IO.File.Delete(target); throw; }
        images.DeleteOwned(userId, previous);
        return Ok(new { filePath = $"/uploads/{name}" });
    }
}
public class LoginDto
{
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(254)]
    public string Email { get; set; } = string.Empty;
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(72)]
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(72)]
    public string OldPassword { get; set; } = string.Empty;
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(72)]
    public string NewPassword { get; set; } = string.Empty;
}
