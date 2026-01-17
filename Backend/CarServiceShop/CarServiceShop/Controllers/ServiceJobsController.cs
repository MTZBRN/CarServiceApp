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

    // GET: api/ServiceJobs/ByAppointment/5
    // Lekéri egy adott időpont munkalapját (alkatrészekkel együtt!)
    [HttpGet("ByAppointment/{appointmentId}")]
    public async Task<ActionResult<ServiceJob>> GetJobByAppointment(int appointmentId)
    {
        var job = await _context.ServiceJobs
            .Include(j => j.JobParts) // FONTOS: Betöltjük az alkatrészeket is
            .FirstOrDefaultAsync(j => j.AppointmentId == appointmentId);

        if (job == null) return NotFound(); // Ha még nincs munkalap, az nem hiba, csak jelezzük
        return job;
    }

    // POST: api/ServiceJobs
    // Létrehoz vagy Frissít egy munkalapot
    [HttpPost]
    public async Task<ActionResult<ServiceJob>> SaveServiceJob(ServiceJob job)
    {
        var existingJob = await _context.ServiceJobs
            .Include(j => j.JobParts)
            .FirstOrDefaultAsync(j => j.AppointmentId == job.AppointmentId);

        if (existingJob == null)
        {
            // Új létrehozása
            _context.ServiceJobs.Add(job);
        }
        else
        {
            // Frissítés
            existingJob.Description = job.Description;
            existingJob.LaborCost = job.LaborCost;
            existingJob.IsCompleted = job.IsCompleted;
            
            // Alkatrészek frissítése (Ez a trükkös rész: töröljük a régieket és berakjuk az újakat)
            // Egyszerűsített megoldás:
            _context.JobParts.RemoveRange(existingJob.JobParts);
            existingJob.JobParts = job.JobParts;
        }

        await _context.SaveChangesAsync();
        return Ok(job);
    }
    // GET: api/ServiceJobs/ByVehicle/5
    // Lekéri egy adott autó ÖSSZES eddigi szerviztörténetét
    [HttpGet("ByVehicle/{vehicleId}")]
    public async Task<ActionResult<IEnumerable<ServiceJob>>> GetJobsByVehicle(int vehicleId)
    {
        var jobs = await _context.ServiceJobs
            .Include(j => j.JobParts)       // Kell az alkatrészlista
            .Include(j => j.Appointment)    // Kell az időpont a dátum miatt
            .Where(j => j.Appointment.VehicleId == vehicleId)
            .OrderByDescending(j => j.Appointment.StartTime) // Legfrissebb elől
            .ToListAsync();

        return jobs;
    }
}