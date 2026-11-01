using CarServiceShop.Data;
using CarServiceShop.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Controllers;

[ApiController, Route("api/[controller]"), EnableRateLimiting("collections")]
public class DashboardController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] CollectionQuery query, [FromQuery] DateTime? date, CancellationToken cancellationToken)
    {
        var today = date?.Date ?? DateTime.Today;
        var start = query.Start ?? today; var end = query.End ?? today.AddDays(1);
        if (!InputRules.Date(today) || end-start > TimeSpan.FromDays(2)) return BadRequest("Invalid dashboard day.");
        var soon = today.AddDays(31);
        var jobs = db.ServiceJobs.AsNoTracking();
        var bookings = db.Appointments.AsNoTracking().Where(a=>a.StartTime>=start && a.StartTime<end);
        var inspections = db.Vehicles.AsNoTracking().Where(v=>v.MOTExpiry<soon);
        var low = db.Parts.AsNoTracking().Where(p=>p.StockQuantity>=0 && p.StockQuantity<5);
        var todayCount = await bookings.CountAsync(cancellationToken);
        var activeCount = await jobs.CountAsync(j=>!j.IsCompleted,cancellationToken);
        var completedCount = await jobs.CountAsync(j=>j.IsCompleted,cancellationToken);
        var inspectionCount = await inspections.CountAsync(cancellationToken);
        var upcomingCount = await inspections.CountAsync(v=>v.MOTExpiry>=today,cancellationToken);
        var lowCount = await low.CountAsync(cancellationToken);
        var bookingRows = await bookings.OrderBy(a=>a.StartTime).ThenBy(a=>a.Id).Take(6).Select(a=>new {
            a.Id,a.StartTime,a.EndTime,a.Note,a.VehicleId,
            Vehicle=new {a.Vehicle!.Id,a.Vehicle.LicensePlate,a.Vehicle.Make,a.Vehicle.Model,a.Vehicle.CustomerId,Customer=a.Vehicle.Customer},
            ServiceJob=a.ServiceJob==null?null:new {a.ServiceJob.Id,a.ServiceJob.IsCompleted}
        }).ToListAsync(cancellationToken);
        var active = await CollectionReads.JobRows(jobs.Where(j=>!j.IsCompleted).OrderBy(j=>j.Date).ThenBy(j=>j.Id).Take(6)).ToListAsync(cancellationToken);
        var recent = await CollectionReads.JobRows(jobs.OrderByDescending(j=>j.Date).ThenByDescending(j=>j.Id).Take(6)).ToListAsync(cancellationToken);
        var inspectionRows = await inspections.Include(v=>v.Customer).OrderBy(v=>v.MOTExpiry).ThenBy(v=>v.Id).Take(6).ToListAsync(cancellationToken);
        var lowRows = await low.OrderBy(p=>p.StockQuantity).ThenBy(p=>p.Id).Take(6).ToListAsync(cancellationToken);
        return Ok(new {todayCount,activeCount,completedCount,inspectionCount,upcomingCount,lowCount,
            bookings=bookingRows,active,recent,inspections=inspectionRows,low=lowRows});
    }
}
