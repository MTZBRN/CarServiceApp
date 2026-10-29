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
    public async Task<ActionResult<IEnumerable<object>>> GetUsers()
    {
        return await _context.Users
            .Select(u => new { u.Id, u.Name, u.Email, u.Role })
            .ToListAsync();
    }

    // Új felhasználó hozzáadása
    [HttpPost]
    public async Task<IActionResult> AddUser([FromBody] CreateUserDto dto)
    {
        if (!CarServiceShop.Security.SecurityRules.ValidPassword(dto.Password)) return BadRequest(new { message = CarServiceShop.Security.SecurityRules.PasswordMessage });
        if (dto.Role != "admin" && dto.Role != "mechanic")
            return BadRequest(new { message = "Érvénytelen szerepkör." });

        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            return BadRequest(new { message = "Ez a felhasználónév már foglalt!" });

        var user = new User
        {
            Name = dto.Name,
            Email = dto.Email,
            Role = dto.Role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password) // ✅ Jelszó hashelése
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Felhasználó sikeresen létrehozva!" });
    }

    // Felhasználó törlése
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Ne tudja magát törölni véletlenül (opcionális)
        // var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);
        // if (id == currentUserId) return BadRequest("Saját magadat nem törölheted!");

        if (user.Role == "admin" && await _context.Users.CountAsync(u => u.Role == "admin") <= 1) return BadRequest("Az utolsó adminisztrátor nem törölhető.");
        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Felhasználó törölve." });
    }
}

// DTO az új felhasználóhoz
public class CreateUserDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "mechanic";
}
