using CarServiceShop.Requests;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Controllers;

    [Route("api/[controller]")]
    [ApiController]
    public class PartsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PartsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetParts([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new(); var q=CollectionReads.Fold(query.Q?.Trim());
        var source=_context.Parts.AsNoTracking().Where(p=>q=="" || CollectionReads.Fold(p.Name+" "+p.PartNumber).Contains(q));
        if(query.PartNumber!=null) {var code=CollectionReads.Fold(query.PartNumber);source=source.Where(p=>CollectionReads.Fold(p.PartNumber)==code);}
        source=query.Stock switch {"out"=>source.Where(p=>p.StockQuantity==0),"low"=>source.Where(p=>p.StockQuantity>0 && p.StockQuantity<5),"available"=>source.Where(p=>p.StockQuantity>=5),"invalid"=>source.Where(p=>p.StockQuantity<0),_=>source};
        return Ok(await CollectionReads.PageAsync(source.OrderBy(p=>p.Id),query,ControllerContext.HttpContext,cancellationToken));
    }

        [HttpPost]
        public async Task<ActionResult<Part>> CreatePart(PartRequest input)
        {
            var part=input.ToEntity();
            _context.Parts.Add(part);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetParts), new { id = part.Id }, part);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePart(int id, PartRequest input)
        {
            if (input.Id.HasValue && id != input.Id) return BadRequest();
            var part = await _context.Parts.FindAsync(id);
            if (part == null) return NotFound();
            if (string.IsNullOrEmpty(input.Version) || input.Version != part.Version) return Conflict(new {message=Integrity.Conflict});
            _context.Entry(part).Property(p=>p.Version).OriginalValue=input.Version;
        _context.Entry(part).Property(p=>p.Version).IsModified=true;
            part.PartNumber=input.PartNumber.Trim(); part.Name=input.Name.Trim();
            part.NetPrice=input.NetPrice; part.GrossPrice=input.GrossPrice; part.StockQuantity=input.StockQuantity;
            try { await _context.SaveChangesAsync(); } catch (DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); }
            return Ok(part);
        }

        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePart(int id)
        {
            var part = await _context.Parts.FindAsync(id);
            if (part == null) return NotFound();
            _context.Parts.Remove(part);
            try { await _context.SaveChangesAsync(); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message="A kapcsolódó üzleti adatok védik ezt a rekordot."}); }
            return NoContent();
        }
    }
