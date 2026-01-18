using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Mvc;

namespace CarServiceShop.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SeedController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SeedController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> SeedData()
    {
        // 👇 1. EZT A SORT SZÚRD BE A LEGELEJÉRE!
        // Ez biztosítja, hogy a táblák létrejöjjenek, mielőtt bármit keresnénk bennük.
        await _context.Database.EnsureCreatedAsync();

        // Innentől mehet a régi kód...
        if (_context.Customers.Any()) 
        {
            return BadRequest("Az adatbázis már tartalmaz adatokat! Töröld ki őket, ha újakat akarsz.");
        }

        // 1. ÜGYFELEK
        var c1 = new Customer { Name = "Kovács János", PhoneNumber = "+36301234567", Email = "janos@gmail.com", Address = "Budapest, Fő utca 1." };
        var c2 = new Customer { Name = "Nagy Éva", PhoneNumber = "+36709876543", Email = "eva.nagy@freemail.hu", Address = "Debrecen, Kossuth tér 5." };
        var c3 = new Customer { Name = "Szabó Péter", PhoneNumber = "+36201112233", Email = "peter.szabo@citromail.hu", Address = "Szeged, Dóm tér 2." };
        var c4 = new Customer { Name = "Varga Kft. (Flotta)", PhoneNumber = "+3612345678", Email = "info@vargakft.hu", Address = "Győr, Ipari park 10." };
        
        _context.Customers.AddRange(c1, c2, c3, c4);
        await _context.SaveChangesAsync();

        // 2. JÁRMŰVEK
        var v1 = new Vehicle { LicensePlate = "ABC-123", Make = "Toyota", Model = "Corolla", Year = 2018, MOTExpiry = DateTime.Now.AddDays(300), CustomerId = c1.Id };
        var v2 = new Vehicle { LicensePlate = "XYZ-987", Make = "Suzuki", Model = "Swift", Year = 2010, MOTExpiry = DateTime.Now.AddDays(-10), CustomerId = c2.Id }; // LEJÁRT MŰSZAKI!
        var v3 = new Vehicle { LicensePlate = "BMW-001", Make = "BMW", Model = "X5", Year = 2022, MOTExpiry = DateTime.Now.AddDays(700), CustomerId = c3.Id };
        var v4 = new Vehicle { LicensePlate = "FLT-001", Make = "Ford", Model = "Transit", Year = 2019, MOTExpiry = DateTime.Now.AddDays(100), CustomerId = c4.Id };
        var v5 = new Vehicle { LicensePlate = "FLT-002", Make = "Ford", Model = "Transit", Year = 2020, MOTExpiry = DateTime.Now.AddDays(400), CustomerId = c4.Id };
        
        _context.Vehicles.AddRange(v1, v2, v3, v4, v5);
        await _context.SaveChangesAsync();

        // 3. RAKTÁR ALKATRÉSZEK (INVENTORY)
        var p1 = new Part { PartNumber = "OLAJ-5W30", Name = "Motorolaj 5W30 (1L)", NetPrice = 3000, GrossPrice = 3810, StockQuantity = 50 };
        var p2 = new Part { PartNumber = "SZUR-OLAJ", Name = "Olajszűrő Univerzális", NetPrice = 1500, GrossPrice = 1905, StockQuantity = 20 };
        var p3 = new Part { PartNumber = "FEK-BET-E", Name = "Fékbetét Készlet (Első)", NetPrice = 12000, GrossPrice = 15240, StockQuantity = 8 };
        var p4 = new Part { PartNumber = "FEK-TARC-E", Name = "Féktárcsa (Első)", NetPrice = 18000, GrossPrice = 22860, StockQuantity = 4 };
        var p5 = new Part { PartNumber = "ABLAK-MOS", Name = "Ablakmosó Folyadék (Téli)", NetPrice = 1000, GrossPrice = 1270, StockQuantity = 100 };

        _context.Parts.AddRange(p1, p2, p3, p4, p5);
        await _context.SaveChangesAsync();

        // 4. MUNKALAPOK (MÚLTBELI ÉS MAI)
        
        // Egy lezárt munka a Toyotához (Múlt)
        var job1 = new ServiceJob
        {
            VehicleId = v1.Id,
            Date = DateTime.Now.AddMonths(-2),
            Description = "Éves kisszerviz (Olaj + Szűrők)",
            IsCompleted = true,
            LaborCost = 15000,
            JobParts = new List<JobPart>
            {
                new JobPart { PartNumber = p1.PartNumber, PartName = p1.Name, Quantity = 4, UnitPrice = p1.GrossPrice },
                new JobPart { PartNumber = p2.PartNumber, PartName = p2.Name, Quantity = 1, UnitPrice = p2.GrossPrice }
            }
        };

        // Egy nyitott munka a Suzukihoz (Ma)
        var job2 = new ServiceJob
        {
            VehicleId = v2.Id,
            Date = DateTime.Now,
            Description = "Műszaki vizsga felkészítés + Fékcsere",
            IsCompleted = false,
            LaborCost = 0, // Még nincs kész
            JobParts = new List<JobPart>
            {
                new JobPart { PartNumber = p3.PartNumber, PartName = p3.Name, Quantity = 1, UnitPrice = p3.GrossPrice }
            }
        };

        _context.ServiceJobs.AddRange(job1, job2);
        
        // 5. NAPTÁR IDŐPONTOK (hogy látszódjon a naptárban is)
        var apt1 = new Appointment { VehicleId = v1.Id, StartTime = DateTime.Now.AddMonths(-2).AddHours(8), EndTime = DateTime.Now.AddMonths(-2).AddHours(10), Note = "Szerviz" };
        var apt2 = new Appointment { VehicleId = v2.Id, StartTime = DateTime.Now.AddHours(9), EndTime = DateTime.Now.AddHours(12), Note = "Műszaki" };
        
        _context.Appointments.AddRange(apt1, apt2);

        await _context.SaveChangesAsync();

        return Ok("Adatbázis sikeresen feltöltve mock adatokkal! 🚀");
    }
}