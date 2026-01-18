using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ServiceJobsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ServiceJobsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/ServiceJobs
    // VISSZAADJA AZ ÖSSZES MUNKÁT (Ez kell a Dashboard listához és naptárhoz!)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ServiceJob>>> GetServiceJobs()
    {
        return await _context.ServiceJobs
            .Include(j => j.JobParts)
            // .Include(j => j.Vehicle) // Ha majd kell a rendszám is a listában
            .OrderByDescending(j => j.Date) // Legfrissebb elől
            .ToListAsync();
    }

    // GET: api/ServiceJobs/5
    // Egy konkrét munka lekérése
    [HttpGet("{id}")]
    public async Task<ActionResult<ServiceJob>> GetServiceJob(int id)
    {
        var serviceJob = await _context.ServiceJobs
            .Include(j => j.JobParts)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (serviceJob == null) return NotFound();

        return serviceJob;
    }

    // POST: api/ServiceJobs
    // ÚJ LÉTREHOZÁSA (Standard Create)
    [HttpPost]
    public async Task<ActionResult<ServiceJob>> CreateServiceJob(ServiceJob serviceJob)
    {
        // Ha nem küldtek dátumot, legyen a mostani
        if (serviceJob.Date == default) serviceJob.Date = DateTime.Now;

        // Ha AppointmentId alapján jön (pl. naptárból konvertáljuk), keressük meg az autót
        if (serviceJob.AppointmentId != null && serviceJob.VehicleId == 0)
        {
            var apt = await _context.Appointments.FindAsync(serviceJob.AppointmentId);
            if (apt != null) serviceJob.VehicleId = apt.VehicleId;
        }

        _context.ServiceJobs.Add(serviceJob);
        await _context.SaveChangesAsync();

        return CreatedAtAction("GetServiceJob", new { id = serviceJob.Id }, serviceJob);
    }

    // PUT: api/ServiceJobs/5
    // FRISSÍTÉS (Javított verzió: Alkatrészeket is frissíti!)
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateServiceJob(int id, ServiceJob serviceJob)
    {
        if (id != serviceJob.Id) return BadRequest();

        // 1. Betöltjük a meglévő munkalapot az alkatrészeivel együtt
        var existingJob = await _context.ServiceJobs
            .Include(j => j.JobParts)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (existingJob == null) return NotFound();

        // 2. Frissítjük az alap adatokat
        existingJob.Description = serviceJob.Description;
        existingJob.LaborCost = serviceJob.LaborCost;
        existingJob.IsCompleted = serviceJob.IsCompleted;
        // existingJob.Date = serviceJob.Date; // Ha a dátumot is szerkeszthetővé teszed

        // 3. Alkatrészek frissítése (Régi törlése, új hozzáadása)
        // Először töröljük a régi alkatrészeket az adatbázisból
        _context.JobParts.RemoveRange(existingJob.JobParts);
        
        // Majd hozzáadjuk a listához az újakat (az EF Core intézi a mentést)
        existingJob.JobParts = serviceJob.JobParts;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.ServiceJobs.Any(e => e.Id == id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

    // DELETE: api/ServiceJobs/5
    // TÖRLÉS
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteServiceJob(int id)
    {
        var serviceJob = await _context.ServiceJobs.FindAsync(id);
        if (serviceJob == null) return NotFound();

        _context.ServiceJobs.Remove(serviceJob);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}