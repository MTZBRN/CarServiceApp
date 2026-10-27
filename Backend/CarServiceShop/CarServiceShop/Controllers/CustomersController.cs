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
    public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers()
    {
        return await _context.Customers.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Customer>> GetCustomer(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        return customer;
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCustomer(int id, Customer input)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.PhoneNumber)) return BadRequest("Név és telefonszám kötelező.");
        customer.Name = input.Name.Trim(); customer.PhoneNumber = input.PhoneNumber.Trim();
        customer.Email = input.Email; customer.Address = input.Address;
        await _context.SaveChangesAsync(); return NoContent();
    }
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        if (await _context.Vehicles.AnyAsync(v => v.CustomerId == id)) return Conflict("A járművel rendelkező ügyfél nem törölhető.");
        _context.Customers.Remove(customer); await _context.SaveChangesAsync(); return NoContent();
    }
    [HttpPost]
    public async Task<ActionResult<Customer>> PostCustomer(Customer customer)
    {
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
    }
}