using CarServiceShop.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CarServiceShop.Data;
using CarServiceShop.Models;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "admin")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    // Összes felhasználó lekérése (jelszó nélkül!)
    [HttpGet]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetUsers([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new(); var q=CollectionReads.Fold(query.Q?.Trim());
        if(ControllerContext.HttpContext!=null) Response.Headers["X-Admin-Count"]=(await _context.Users.CountAsync(u=>u.Role=="admin",cancellationToken)).ToString();
        return Ok(await CollectionReads.PageAsync(_context.Users.AsNoTracking().Where(u=>q=="" || CollectionReads.Fold(u.Name+" "+u.Email).Contains(q)).OrderBy(u=>u.Id).Select(u=>new {u.Id,u.Name,u.Email,u.Role}),query,ControllerContext.HttpContext,cancellationToken));
    }

    // Új felhasználó hozzáadása
    [HttpPost]
    public async Task<IActionResult> AddUser([FromBody] CreateUserDto dto)
    {
        if (!CarServiceShop.Security.SecurityRules.ValidPassword(dto.Password)) return BadRequest(new { message = CarServiceShop.Security.SecurityRules.PasswordMessage });
        if (dto.Role != "admin" && dto.Role != "mechanic")
            return BadRequest(new { message = "Érvénytelen szerepkör." });

        var normalized=Integrity.NormalizeLogin(dto.Email);
        if (await _context.Users.AnyAsync(u => u.NormalizedLogin == normalized))
            return BadRequest(new { message = "Ez a felhasználónév már foglalt!" });

        var user = new User
        {
            Name = dto.Name,
            Email = dto.Email,
            Role = dto.Role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password) // ✅ Jelszó hashelése
        };

        _context.Users.Add(user);
        try { await _context.SaveAuditedAsync(user); }
        catch (DbUpdateException ex) when (Integrity.Constraint(ex)) { return BadRequest(new {message="A felhasználónév már foglalt, vagy az utolsó adminisztrátor nem törölhető."}); }

        return Ok(new { message = "Felhasználó sikeresen létrehozva!" });
    }

    // Felhasználó törlése
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id, [FromServices] CarServiceShop.Security.ProfileImages? images=null)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Ne tudja magát törölni véletlenül (opcionális)
        // var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);
        // if (id == currentUserId) return BadRequest("Saját magadat nem törölheted!");

        if (user.Role == "admin" && await _context.Users.CountAsync(u => u.Role == "admin") <= 1) return BadRequest("Az utolsó adminisztrátor nem törölhető.");
        _context.Users.Remove(user);
        try { await _context.SaveAuditedAsync(user); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return BadRequest(new {message="Az utolsó adminisztrátor nem törölhető."}); }
        // Only this deleted account's known generated basename; historical orphans require operator review.
        images?.TryDeleteOwned(user.Id,user.ProfilePicturePath);
        return Ok(new { message = "Felhasználó törölve." });
    }
}

// DTO az új felhasználóhoz
public class CreateUserDto : System.ComponentModel.DataAnnotations.IValidatableObject
{
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(200)]
    public string Name { get; set; } = string.Empty;
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(254)]
    public string Email { get; set; } = string.Empty;
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(72)]
    public string Password { get; set; } = string.Empty;
    [System.ComponentModel.DataAnnotations.RegularExpression("^(admin|mechanic)$")]
    public string Role { get; set; } = "mechanic";
    public IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> Validate(System.ComponentModel.DataAnnotations.ValidationContext context) {
        if (Email.Contains('@') && !InputRules.Email(Email)) yield return new("Invalid email.", [nameof(Email)]);
    }
}
