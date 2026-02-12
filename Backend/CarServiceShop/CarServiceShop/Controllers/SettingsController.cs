using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CarServiceShop.Data;
using CarServiceShop.Models;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "admin")]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<GlobalSettings>> GetSettings()
    {
        var settings = await _context.GlobalSettings.FirstOrDefaultAsync();
        if (settings == null) return Ok(new GlobalSettings()); // Üres alapértelmezett
        return settings;
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSettings([FromBody] GlobalSettings settings)
    {
        var existing = await _context.GlobalSettings.FirstOrDefaultAsync();

        if (existing == null) {
            _context.GlobalSettings.Add(settings);
        } else {
            // Frissítjük a meglévőt
            existing.CompanyName = settings.CompanyName;
            existing.Address = settings.Address;
            existing.TaxNumber = settings.TaxNumber;
            existing.Phone = settings.Phone;
            existing.Email = settings.Email;
            existing.HourlyRate = settings.HourlyRate;
            existing.VatRate = settings.VatRate;
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Beállítások elmentve az adatbázisba!" });
    }
}