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
        public async Task<ActionResult<IEnumerable<Part>>> GetParts()
        {
            return await _context.Parts.ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<Part>> CreatePart(Part part)
        {
            _context.Parts.Add(part);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetParts), new { id = part.Id }, part);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePart(int id, Part part)
        {
            if (id != part.Id) return BadRequest();
            _context.Entry(part).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePart(int id)
        {
            var part = await _context.Parts.FindAsync(id);
            if (part == null) return NotFound();
            _context.Parts.Remove(part);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }