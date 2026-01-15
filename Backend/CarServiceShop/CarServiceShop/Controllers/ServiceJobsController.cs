using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ServiceJob>>> GetServiceJobs()
    {
        return await _context.ServiceJobs
            .Include(s => s.Vehicle) // Melyik autó
            .Include(s => s.JobParts) // Milyen alkatrészek
            .OrderByDescending(s => s.JobDate) // Legfrissebb elöl
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<ServiceJob>> PostServiceJob(ServiceJob serviceJob)
    {
        _context.ServiceJobs.Add(serviceJob);
        await _context.SaveChangesAsync();
        return Ok(serviceJob);
    }
}