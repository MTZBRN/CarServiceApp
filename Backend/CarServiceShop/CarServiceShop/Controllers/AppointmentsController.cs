using CarServiceShop.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AppointmentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AppointmentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // Itt fontos: a StartTime szerint rendezve kérjük le, hogy sorban legyenek!
    [HttpGet]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetAppointments([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new();
        var source=CollectionReads.Bookings(_context.Appointments.AsNoTracking(),query).OrderBy(a=>a.StartTime).ThenBy(a=>a.Id)
            .Select(a=>new { a.Id,a.Version,a.VehicleId,a.StartTime,a.EndTime,a.Note,
                Vehicle=new Vehicle {Id=a.Vehicle!.Id,LicensePlate=a.Vehicle.LicensePlate,Make=a.Vehicle.Make,Model=a.Vehicle.Model,Year=a.Vehicle.Year,CustomerId=a.Vehicle.CustomerId,Customer=a.Vehicle.Customer},
                ServiceJob=a.ServiceJob==null?null:new {a.ServiceJob.Id,a.ServiceJob.IsCompleted} });
        return Ok(await CollectionReads.PageAsync(source,query,ControllerContext.HttpContext,cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Appointment>> GetAppointment(int id)
    {
        var appointment = await _context.Appointments
            .Include(a => a.Vehicle)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment == null) return NotFound();

        return Ok(appointment);
    }

    [HttpPost]
    public async Task<ActionResult<Appointment>> PostAppointment(AppointmentRequest input)
    {
        if (!await _context.Vehicles.AnyAsync(v=>v.Id==input.VehicleId)) return BadRequest("Invalid vehicle.");
        var appointment = input.ToEntity();
        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();
        return Ok(appointment);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> PutAppointment(int id, AppointmentRequest appointment)
    {
        if (appointment.Id.HasValue && id != appointment.Id) return BadRequest();
        if (!await _context.Vehicles.AnyAsync(v=>v.Id==appointment.VehicleId)) return BadRequest("Invalid vehicle.");

        var appointmentInDb = await _context.Appointments.FindAsync(id);
        if (appointmentInDb == null) return NotFound();
        if (string.IsNullOrEmpty(appointment.Version) || appointment.Version != appointmentInDb.Version) return Conflict(new {message=Integrity.Conflict});
        _context.Entry(appointmentInDb).Property(a=>a.Version).OriginalValue=appointment.Version;
        _context.Entry(appointmentInDb).Property(a=>a.Version).IsModified=true;

        if (appointmentInDb.VehicleId != appointment.VehicleId &&
            await _context.ServiceJobs.AnyAsync(j => j.AppointmentId == id))
            return Conflict("Munkalappal rendelkező időpont járműve nem módosítható.");

        appointmentInDb.StartTime = appointment.StartTime;
        appointmentInDb.EndTime = appointment.EndTime;
        appointmentInDb.Note = appointment.Note;
        appointmentInDb.VehicleId = appointment.VehicleId;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new {message=Integrity.Conflict});
        }

        return Ok(appointmentInDb);
    }

    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAppointment(int id)
    {
        var appointment = await _context.Appointments.FindAsync(id);
        if (appointment == null) return NotFound();

        var job = await _context.ServiceJobs.SingleOrDefaultAsync(j => j.AppointmentId == id);
        if (job != null) job.AppointmentId = null;
        _context.Appointments.Remove(appointment);
        try { await _context.SaveChangesAsync(); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message="A kapcsolódó üzleti adatok védik ezt a rekordot."}); }
        return NoContent();
    }
}