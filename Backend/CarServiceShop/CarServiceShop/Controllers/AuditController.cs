using System.ComponentModel.DataAnnotations;
using CarServiceShop.Data;
using CarServiceShop.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Controllers;

public sealed class AuditQuery : CollectionQuery
{
    [Range(1,int.MaxValue)] public int? ActorId {get;set;}
    [StringLength(64),RegularExpression("^[A-Za-z.]+$")] public string? Action {get;set;}
    [StringLength(32),RegularExpression("^[A-Za-z]+$")] public string? ResourceType {get;set;}
    [Range(1,int.MaxValue)] public int? ResourceId {get;set;}
    [RegularExpression("^(Success|Failure)$")] public string? Outcome {get;set;}
}

[ApiController,Route("api/[controller]"),Authorize(Roles="admin"),EnableRateLimiting("collections")]
public sealed class AuditController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] AuditQuery query,CancellationToken cancellationToken)
    {
        var rows=db.AuditEvents.AsNoTracking();
        if(query.From.HasValue)rows=rows.Where(e=>e.TimestampUtc>=query.From);
        if(query.To.HasValue){var until=query.To.Value.Date.AddDays(1);rows=rows.Where(e=>e.TimestampUtc<until);}
        if(query.ActorId.HasValue)rows=rows.Where(e=>e.ActorUserId==query.ActorId);
        if(query.Action!=null)rows=rows.Where(e=>e.Action==query.Action);
        if(query.ResourceType!=null)rows=rows.Where(e=>e.ResourceType==query.ResourceType);
        if(query.ResourceId.HasValue)rows=rows.Where(e=>e.ResourceId==query.ResourceId);
        if(query.Outcome!=null)rows=rows.Where(e=>e.Outcome==query.Outcome);
        return Ok(await CollectionReads.PageAsync(rows.OrderByDescending(e=>e.TimestampUtc).ThenByDescending(e=>e.Id),query,HttpContext,cancellationToken));
    }
}
