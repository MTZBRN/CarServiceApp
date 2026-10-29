using CarServiceShop.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    public async Task<ActionResult<JobPart>> PostJobPart(JobPartRequest input)
    {
        if (!await _context.ServiceJobs.AnyAsync(j=>j.Id==input.ServiceJobId)) return BadRequest("Invalid worksheet.");
        var jobPart=input.ToEntity(); jobPart.ServiceJobId=input.ServiceJobId;
        _context.JobParts.Add(jobPart);
        await _context.SaveChangesAsync();
        return Ok(jobPart);
    }
}