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

    private readonly TimeProvider _clock;
    private long Now => _clock.GetUtcNow().ToUnixTimeMilliseconds();

    public AuthController(ApplicationDbContext context, IConfiguration configuration, TimeProvider clock)
    {
        _context = context;
        _configuration = configuration;
        _clock = clock;
    }

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [RequestSizeLimit(4096)]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto, [FromServices] LoginThrottle throttle, [FromServices] AuditFailureBudget budget)
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
        if (user == null || !valid) {
            if(budget.Take()) {
                try { await _context.Audit.AppendAsync(_context,_context.Audit.Create("Auth.LoginFailed","User",user?.Id,resolvedActor:user,failure:true),HttpContext.RequestAborted); }
                catch(Exception error) when(error is not OperationCanceledException) {
                    // Failed-login responses remain generic even if optional sampled auditing is unavailable.
                    HttpContext.RequestServices.GetRequiredService<ILogger<AuthController>>().LogWarning("Sampled login failure audit unavailable.");
                }
            }
            return Unauthorized(new { message = "Hibás bejelentkezési adatok!" });
        }
        var now = Now;
        await _context.Sessions.Where(s => s.IdleUntil <= now).ExecuteDeleteAsync(HttpContext.RequestAborted);
        var session = StartSession(user, now);
        await _context.Audit.AppendAsync(_context,_context.Audit.Create("Auth.LoginSucceeded","User",user.Id,resolvedActor:user),HttpContext.RequestAborted);
        var tokenString = IssueToken(user, session);

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
        var now = Now;
        var idleUntil = await WorkshopSession.Active(_context, User, now).Select(s => (long?)s.IdleUntil).SingleOrDefaultAsync();
        if (idleUntil == null) return Unauthorized();
        return Ok(new { userName = user.Name, user.Role, user.ProfilePicturePath,
            sessionId = User.FindFirstValue(WorkshopSession.Claim), remainingMs = idleUntil - now });
    }

    [Authorize, HttpPost("activity"), EnableRateLimiting("activity")]
    public async Task<IActionResult> Activity()
    {
        // SQLite's immediate write transaction serializes writers. Read the clock
        // after acquiring it so waiting for another writer cannot revive an expired login.
        await using var transaction = await _context.Database.BeginTransactionAsync(HttpContext.RequestAborted);
        var now = Now;
        var active = WorkshopSession.Active(_context, User, now);
        var deadline = now + WorkshopSession.IdleMilliseconds;
        // A late or concurrent gesture cannot resurrect a session or move its deadline backwards.
        var changed = await active.ExecuteUpdateAsync(update => update.SetProperty(s => s.IdleUntil,
            s => Math.Max(s.IdleUntil, Math.Min(deadline, s.AbsoluteUntil))), HttpContext.RequestAborted);
        if (changed == 0) return Unauthorized();
        var until = await active.Select(s => (long?)s.IdleUntil).SingleOrDefaultAsync();
        if (until == null) return Unauthorized();
        await transaction.CommitAsync(HttpContext.RequestAborted);
        return Ok(new { remainingMs = until - Now });
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
        var session = StartSession(user, Now);
        await _context.SaveAuditedAsync(user,SecurityAuditAction.PasswordChanged);

        return Ok(new { message = "Jelszó sikeresen megváltoztatva!", token = IssueToken(user, session) });
    }

    // Logout revokes all access tokens for this identity, never a supplied user ID.
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromQuery] bool currentSessionOnly = false)
    {
        var id=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        // SQL assignment avoids lost invalidation under simultaneous password/logout requests.
        var version = Guid.NewGuid().ToString("N");
        await using var transaction=await _context.Database.BeginTransactionAsync(HttpContext.RequestAborted);
        if (currentSessionOnly) {
            var sessionId = User.FindFirstValue(WorkshopSession.Claim);
            await _context.Sessions.Where(s => s.UserId == id && s.Id == sessionId).ExecuteDeleteAsync(HttpContext.RequestAborted);
        } else if(await _context.Users.Where(u=>u.Id==id).ExecuteUpdateAsync(s=>s.SetProperty(u=>u.SessionVersion,version))!=1) return Unauthorized();
        await _context.Audit.AppendAsync(_context,_context.Audit.Create("Auth.SessionRevoked","User",id),HttpContext.RequestAborted);
        await transaction.CommitAsync(HttpContext.RequestAborted);
        return NoContent();
    }

    private WorkshopSession StartSession(User user, long now)
    {
        var session = new WorkshopSession { UserId = user.Id, IdleUntil = now + WorkshopSession.IdleMilliseconds,
            AbsoluteUntil = now + (long)TimeSpan.FromHours(8).TotalMilliseconds };
        _context.Sessions.Add(session);
        return session;
    }

    private string IssueToken(User user, WorkshopSession session)
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
                new Claim("session_version", user.SessionVersion),
                new Claim(WorkshopSession.Claim, session.Id)
            }),
            Issuer = ProductionHardening.JwtScope(_configuration,"Issuer",HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()),
            Audience = ProductionHardening.JwtScope(_configuration,"Audience",HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()),
            Expires = DateTimeOffset.FromUnixTimeMilliseconds(session.AbsoluteUntil).UtcDateTime,
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
    [EnableRateLimiting("uploads")]
    [RequestSizeLimit(ProfileImages.MaxBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = ProfileImages.MaxBytes + 65536)]
    public async Task<IActionResult> UploadProfilePicture(IFormFile file, [FromServices] ProfileImages images)
    {
        if (file == null || file.Length == 0 || file.Length > ProfileImages.MaxBytes) return BadRequest("PNG/JPEG kép szükséges, legfeljebb 2 MiB.");
        // MIME/filename never decide the output type. Only a successful raster decode is accepted.
        if (file.ContentType is not ("image/png" or "image/jpeg")) return BadRequest("Érvénytelen képtípus.");
        using var ownedLock = await images.LockAsync(HttpContext.RequestAborted);
        if(ownedLock==null) return StatusCode(429,new {message="An image upload is already in progress. Try again shortly."});
        using var input = new MemoryStream();
        await file.CopyToAsync(input);
        var normalized = ProfileImages.Normalize(input.ToArray());
        if (normalized == null) return BadRequest("Érvénytelen PNG/JPEG kép (maximum 2048 × 2048).");
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();
        var previous = user.ProfilePicturePath;
        if(!images.HasRoom(userId,previous,normalized.Length)) return StatusCode(507,new {message="Managed profile storage is full. Contact an administrator."});
        var name = $"profile_{userId}_{Guid.NewGuid():N}.png";
        Directory.CreateDirectory(images.DirectoryPath);
        var target = Path.Combine(images.DirectoryPath, name);
        try {
            await using (var stream = new FileStream(target, FileMode.CreateNew)) await stream.WriteAsync(normalized);
            user.ProfilePicturePath = name;
            await _context.SaveAuditedAsync(user,SecurityAuditAction.ProfileImageChanged);
        } catch { System.IO.File.Delete(target); throw; }
        images.TryDeleteOwned(userId, previous);
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
