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
    public async Task<ActionResult<IEnumerable<Vehicle>>> GetVehicles()
    {
        // Az Include(c => c.Customer) azért kell, hogy a tulaj adatait is betöltse!
        return await _context.Vehicles
            .Include(v => v.Customer)
            .ToListAsync();
    }

    // 2. Egy konkrét autó lekérése ID alapján
    // GET: api/vehicles/5
    [HttpGet("{id}")]
    public async Task<ActionResult<Vehicle>> GetVehicle(int id)
    {
        var vehicle = await _context.Vehicles
            .Include(v => v.Customer)
            .Include(v => v.ServiceJobs) // A szerviztörténetet is látni akarjuk
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
    public async Task<ActionResult<Vehicle>> PostVehicle(Vehicle vehicle)
    {
        // Ellenőrizzük, hogy létezik-e az ügyfél, akihez hozzáadjuk
        var customerExists = await _context.Customers.AnyAsync(c => c.Id == vehicle.CustomerId);
        if (!customerExists)
        {
            return BadRequest("A megadott ügyfél (CustomerId) nem létezik!");
        }

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, vehicle);
    }

    // 4. Autó törlése
    // DELETE: api/vehicles/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(int id)
    {
        var vehicle = await _context.Vehicles.FindAsync(id);
        if (vehicle == null)
        {
            return NotFound();
        }

        _context.Vehicles.Remove(vehicle);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

