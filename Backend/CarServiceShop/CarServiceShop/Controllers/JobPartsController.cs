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
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("worksheet-writes")]
    public async Task<ActionResult<JobPart>> PostJobPart(JobPartRequest input)
    {
        var job=await _context.ServiceJobs.FindAsync(input.ServiceJobId);
        if (job==null) return BadRequest("Invalid worksheet.");
        if (job.IsCompleted && !User.IsInRole("admin")) return Forbid();
        if (await _context.JobParts.CountAsync(p=>p.ServiceJobId==job.Id) >= 500) return BadRequest("A worksheet may contain at most 500 line items.");
        if (string.IsNullOrEmpty(input.Version) || input.Version!=job.Version) return Conflict(new {message=Integrity.Conflict});
        _context.Entry(job).Property(j=>j.Version).OriginalValue=input.Version;
        _context.Entry(job).Property(j=>j.Version).IsModified=true;
        var jobPart=input.ToEntity(); jobPart.ServiceJobId=input.ServiceJobId;
        _context.JobParts.Add(jobPart);
        try { await _context.SaveChangesAsync(); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); }
        return Ok(jobPart);
    }
}
