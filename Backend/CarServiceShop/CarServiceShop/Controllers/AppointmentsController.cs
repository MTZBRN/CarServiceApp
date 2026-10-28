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
    public async Task<ActionResult<IEnumerable<Appointment>>> GetAppointments()
    {
        return await _context.Appointments
            .Include(a => a.Vehicle) // Lássuk, melyik autó jön
            .OrderBy(a => a.StartTime)
            .ToListAsync();
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
    public async Task<ActionResult<Appointment>> PostAppointment(Appointment appointment)
    {
        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();
        return Ok(appointment);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> PutAppointment(int id, Appointment appointment)
    {
        if (id != appointment.Id) return BadRequest();

        var appointmentInDb = await _context.Appointments.FindAsync(id);
        if (appointmentInDb == null) return NotFound();

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
            if (!await _context.Appointments.AnyAsync(a => a.Id == id))
                return NotFound();

            throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAppointment(int id)
    {
        var appointment = await _context.Appointments.FindAsync(id);
        if (appointment == null) return NotFound();

        var job = await _context.ServiceJobs.SingleOrDefaultAsync(j => j.AppointmentId == id);
        if (job != null) job.AppointmentId = null;
        _context.Appointments.Remove(appointment);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}