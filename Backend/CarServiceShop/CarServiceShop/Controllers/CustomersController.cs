using CarServiceShop.Requests;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using CarServiceShop.Data;
using CarServiceShop.Models;


namespace CarServiceShop.Controllers;



[Route("api/[controller]")]
[ApiController]
public class CustomersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CustomersController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("collections")]
    public async Task<IActionResult> GetCustomers([FromQuery] CollectionQuery? input=null, CancellationToken cancellationToken=default)
    {
        var query=input??new(); var q=CollectionReads.Fold(query.Q?.Trim());
        var source=_context.Customers.AsNoTracking().Where(c=>q=="" || CollectionReads.Fold(c.Name+" "+c.PhoneNumber+" "+(c.Email??"")).Contains(q));
        return Ok(await CollectionReads.PageAsync(source.OrderBy(c=>c.Id).Select(c=>new {c.Id,c.Name,c.PhoneNumber,c.Email,c.Address,VehicleCount=c.Vehicles.Count}),query,ControllerContext.HttpContext,cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Customer>> GetCustomer(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        return customer;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCustomer(int id, CustomerRequest input)
    {
        if (input.Id.HasValue && input.Id != id) return BadRequest();
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.PhoneNumber)) return BadRequest("Név és telefonszám kötelező.");
        customer.Name = input.Name.Trim(); customer.PhoneNumber = input.PhoneNumber.Trim();
        customer.Email = input.Email; customer.Address = input.Address;
        await _context.SaveAuditedAsync(customer); return NoContent();
    }
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        if (await _context.Vehicles.AnyAsync(v => v.CustomerId == id)) return Conflict("A járművel rendelkező ügyfél nem törölhető.");
        _context.Customers.Remove(customer); try { await _context.SaveAuditedAsync(customer); } catch(DbUpdateConcurrencyException) { return Conflict(new {message=Integrity.Conflict}); } catch(DbUpdateException ex) when(Integrity.Constraint(ex)) { return Conflict(new {message="A kapcsolódó üzleti adatok védik ezt a rekordot."}); } return NoContent();
    }
    [HttpPost]
    public async Task<ActionResult<Customer>> PostCustomer(CustomerRequest input)
    {
        var customer = input.ToEntity();
        _context.Customers.Add(customer);
        await _context.SaveAuditedAsync(customer);
        return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
    }
}