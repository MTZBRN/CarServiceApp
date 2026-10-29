using CarServiceShop.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CarServiceShop.Data;
using CarServiceShop.Models;

[Route("api/[controller]")]
[ApiController]
[Authorize]
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

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> UpdateSettings([FromBody] SettingsRequest settings)
    {
        var existing = await _context.GlobalSettings.FirstOrDefaultAsync();

        if (existing == null) {
            var created=settings.ToEntity(); created.Id=1;
            _context.GlobalSettings.Add(created);
        } else {
            if (string.IsNullOrEmpty(settings.Version) || settings.Version != existing.Version) return Conflict(new {message=Integrity.Conflict});
            _context.Entry(existing).Property(s=>s.Version).OriginalValue=settings.Version;
        _context.Entry(existing).Property(s=>s.Version).IsModified=true;
            // Frissítjük a meglévőt
            existing.CompanyName = settings.CompanyName;
            existing.Address = settings.Address;
            existing.TaxNumber = settings.TaxNumber;
            existing.Phone = settings.Phone;
            existing.Email = settings.Email;
            existing.HourlyRate = settings.HourlyRate;
            existing.VatRate = settings.VatRate;
        }

        try { await _context.SaveChangesAsync(); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); }
        catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message=Integrity.Conflict}); }
        return Ok(await _context.GlobalSettings.FirstAsync());
    }
}