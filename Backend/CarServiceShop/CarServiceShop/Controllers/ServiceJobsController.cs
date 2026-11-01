using CarServiceShop.Requests;
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
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetServiceJobs([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new();
        return Ok(await CollectionReads.PageAsync(CollectionReads.JobRows(CollectionReads.Jobs(_context.ServiceJobs.AsNoTracking(),query).OrderByDescending(j=>j.Date).ThenByDescending(j=>j.Id)),query,ControllerContext.HttpContext,cancellationToken));
    }

    // GET: api/ServiceJobs/5
    // Egy konkrét munka lekérése
    [HttpGet("ByAppointment/{appointmentId}")]
    public async Task<ActionResult<ServiceJob>> GetByAppointment(int appointmentId)
    {
        var job = await _context.ServiceJobs.Include(j => j.JobParts).SingleOrDefaultAsync(j => j.AppointmentId == appointmentId);
        return job == null ? NotFound() : Ok(job);
    }
    [HttpGet("{id}")]
    public async Task<ActionResult<ServiceJob>> GetServiceJob(int id)
    {
        var serviceJob = await _context.ServiceJobs
            .Include(j => j.JobParts)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (serviceJob == null) return NotFound();

        return serviceJob;
    }

    // GET: api/ServiceJobs/ByVehicle/5
    // Egy járműhöz tartozó szerviztörténet lekérése
    [HttpGet("ByVehicle/{vehicleId}")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetServiceHistory(int vehicleId, [FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new(); query.VehicleId=vehicleId;
        return Ok(await CollectionReads.PageAsync(CollectionReads.JobRows(CollectionReads.Jobs(_context.ServiceJobs.AsNoTracking(),query).OrderByDescending(j=>j.Date).ThenByDescending(j=>j.Id)),query,ControllerContext.HttpContext,cancellationToken));
    }

    // POST: api/ServiceJobs
    // ÚJ LÉTREHOZÁSA (Standard Create)
    [HttpPost]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("worksheet-writes")]
    public async Task<ActionResult<ServiceJob>> CreateServiceJob(CreateWorksheetRequest input)
    {
        var serviceJob = new ServiceJob { VehicleId=input.VehicleId, AppointmentId=input.AppointmentId, Date=input.Date ?? DateTime.Now,
            Description=input.Description, LaborCost=input.LaborCost, IsCompleted=input.IsCompleted, JobParts=input.JobParts.Select(p=>p.ToEntity()).ToList() };

        // Ha AppointmentId alapján jön (pl. naptárból konvertáljuk), keressük meg az autót
        if (serviceJob.AppointmentId != null && serviceJob.VehicleId == 0)
        {
            var apt = await _context.Appointments.FindAsync(serviceJob.AppointmentId);
            if (apt != null) serviceJob.VehicleId = apt.VehicleId;
        }

        if (!await _context.Vehicles.AnyAsync(v => v.Id == serviceJob.VehicleId)) return BadRequest("Invalid vehicle.");
        if (serviceJob.AppointmentId.HasValue) {
            var appointment = await _context.Appointments.FindAsync(serviceJob.AppointmentId);
            if (appointment == null || appointment.VehicleId != serviceJob.VehicleId) return BadRequest("Invalid appointment.");
            if (await _context.ServiceJobs.AnyAsync(j => j.AppointmentId == serviceJob.AppointmentId)) return Conflict("Appointment already has a worksheet.");
        }
        serviceJob.Id = 0;
        serviceJob.JobParts = serviceJob.JobParts.Select(p => new JobPart { PartName = p.PartName, PartNumber = p.PartNumber, Quantity = p.Quantity, UnitPrice = p.UnitPrice }).ToList();
        _context.ServiceJobs.Add(serviceJob);
        await _context.SaveAuditedAsync(serviceJob);

        return CreatedAtAction("GetServiceJob", new { id = serviceJob.Id }, serviceJob);
    }

    // PUT: api/ServiceJobs/5
    // FRISSÍTÉS (Javított verzió: Alkatrészeket is frissíti!)
    [HttpPut("{id}")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("worksheet-writes")]
    public async Task<IActionResult> UpdateServiceJob(int id, UpdateWorksheetRequest serviceJob)
    {
        if (serviceJob.Id.HasValue && id != serviceJob.Id) return BadRequest();

        // 1. Betöltjük a meglévő munkalapot az alkatrészeivel együtt
        var existingJob = await _context.ServiceJobs
            .Include(j => j.JobParts)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (existingJob == null) return NotFound();
        if (existingJob.IsCompleted && !User.IsInRole("admin")) return Forbid();
        if (string.IsNullOrEmpty(serviceJob.Version) || serviceJob.Version != existingJob.Version) return Conflict(new {message=Integrity.Conflict});
        _context.Entry(existingJob).Property(j=>j.Version).OriginalValue=serviceJob.Version;
        _context.Entry(existingJob).Property(j=>j.Version).IsModified=true;

        if (!await _context.Vehicles.AnyAsync(v=>v.Id==existingJob.VehicleId)) return BadRequest("Invalid vehicle.");
        if (existingJob.AppointmentId.HasValue && !await _context.Appointments.AnyAsync(a=>a.Id==existingJob.AppointmentId && a.VehicleId==existingJob.VehicleId)) return BadRequest("Invalid appointment.");
        // 2. Frissítjük az alap adatokat
        existingJob.Description = serviceJob.Description;
        existingJob.LaborCost = serviceJob.LaborCost;
        existingJob.IsCompleted = serviceJob.IsCompleted;
        // existingJob.Date = serviceJob.Date; // Ha a dátumot is szerkeszthetővé teszed

        // 3. Alkatrészek frissítése (Régi törlése, új hozzáadása)
        // Először töröljük a régi alkatrészeket az adatbázisból
        _context.JobParts.RemoveRange(existingJob.JobParts);
        
        // Majd hozzáadjuk a listához az újakat (az EF Core intézi a mentést)
        existingJob.JobParts = serviceJob.JobParts.Select(p => new JobPart { PartName = p.PartName, PartNumber = p.PartNumber, Quantity = p.Quantity, UnitPrice = p.UnitPrice }).ToList();

        try
        {
            await _context.SaveAuditedAsync(existingJob);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new {message=Integrity.Conflict});
        }

        return Ok(existingJob);
    }

    // DELETE: api/ServiceJobs/5
    // TÖRLÉS
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteServiceJob(int id)
    {
        var serviceJob = await _context.ServiceJobs.FindAsync(id);
        if (serviceJob == null) return NotFound();

        _context.ServiceJobs.Remove(serviceJob);
        try { await _context.SaveAuditedAsync(serviceJob); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message="A kapcsolódó üzleti adatok védik ezt a rekordot."}); }

        return NoContent();
    }
}
