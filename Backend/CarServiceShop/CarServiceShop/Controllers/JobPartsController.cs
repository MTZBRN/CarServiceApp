using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")]
[ApiController]
public class JobPartsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public JobPartsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // Csak hozzáadás kell, mert a listázást a ServiceJob-nál intézzük
    [HttpPost]
    public async Task<ActionResult<JobPart>> PostJobPart(JobPart jobPart)
    {
        _context.JobParts.Add(jobPart);
        await _context.SaveChangesAsync();
        return Ok(jobPart);
    }
}