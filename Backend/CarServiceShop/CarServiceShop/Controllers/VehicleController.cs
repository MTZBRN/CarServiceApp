using CarServiceShop.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CarServiceShop.Data;
using CarServiceShop.Models;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")] // Ez lesz az URL: api/vehicles
[ApiController]
public class VehicleController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    // Itt kérjük el az adatbázis kapcsolatot (Dependency Injection)
    public VehicleController(ApplicationDbContext context)
    {
        _context = context;
    }

    // 1. Összes autó lekérdezése
    // GET: api/vehicles
    [HttpGet]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetVehicles([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new();
        return Ok(await CollectionReads.PageAsync(CollectionReads.Vehicles(_context.Vehicles.AsNoTracking(),query).Include(v=>v.Customer).OrderBy(v=>v.Id),query,ControllerContext.HttpContext,cancellationToken));
    }

    // 2. Egy konkrét autó lekérése ID alapján
    // GET: api/vehicles/5
    [HttpGet("{id}")]
    public async Task<ActionResult<Vehicle>> GetVehicle(int id)
    {
        var vehicle = await _context.Vehicles
            .Include(v => v.Customer)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (vehicle == null)
        {
            return NotFound();
        }

        return vehicle;
    }

    // 3. Új autó felvétele
    // POST: api/vehicles
    [HttpPost]
    public async Task<ActionResult<Vehicle>> PostVehicle(VehicleRequest input)
    {
        // Ellenőrizzük, hogy létezik-e az ügyfél, akihez hozzáadjuk
        var customerExists = await _context.Customers.AnyAsync(c => c.Id == input.CustomerId);
        if (!customerExists)
        {
            return BadRequest("A megadott ügyfél (CustomerId) nem létezik!");
        }

        var vehicle = input.ToEntity();
        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, vehicle);
    }

    // 4. Autó törlése
    // DELETE: api/vehicles/5
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(int id)
    {
        var vehicle = await _context.Vehicles.FindAsync(id);
        if (vehicle == null)
        {
            return NotFound();
        }

        if (await _context.ServiceJobs.AnyAsync(j => j.VehicleId == id) || await _context.Appointments.AnyAsync(a => a.VehicleId == id)) return Conflict("Szerviztörténettel vagy időponttal rendelkező jármű nem törölhető.");
        _context.Vehicles.Remove(vehicle);
        try { await _context.SaveChangesAsync(); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message="A kapcsolódó üzleti adatok védik ezt a rekordot."}); }

        return NoContent();
    }
}

