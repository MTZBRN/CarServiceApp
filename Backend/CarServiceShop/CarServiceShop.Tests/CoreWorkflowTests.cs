using CarServiceShop.Requests;
using CarServiceShop.Controllers;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.AspNetCore.Mvc;

namespace CarServiceShop.Tests;

public class CoreWorkflowTests
{
    [Fact]
    public async Task ExistingDatabaseUpgrade_PreservesWorksheetWhenAppointmentDeleted()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20260212210503_AddGlobalSettings");
        // Seed the historical schema with SQL: the current EF model now includes Version columns.
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Customers (Id,Name,PhoneNumber) VALUES (1,'Customer','123'); INSERT INTO Vehicles (Id,LicensePlate,Make,Model,Year,CustomerId) VALUES (1,'TEST','','',2020,1); INSERT INTO Appointments (Id,VehicleId,Note,StartTime,EndTime) VALUES (1,1,'Oil change','2026-01-01','2026-01-02'); INSERT INTO ServiceJobs (Id,VehicleId,AppointmentId,Date,Description,IsCompleted,LaborCost) VALUES (1,1,1,'2026-01-01','Historical job',0,0); INSERT INTO JobParts (Id,ServiceJobId,PartName,PartNumber,Quantity,UnitPrice) VALUES (1,1,'Oil','',1,100);");
        await db.Database.MigrateAsync();
        db.ChangeTracker.Clear();
        // Exercise the database FK itself, independently of controller detachment.
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM Appointments WHERE Id = {1}");
        var saved = await db.ServiceJobs.Include(j => j.JobParts).SingleAsync();
        Assert.Null(saved.AppointmentId);
        Assert.Equal("Oil", Assert.Single(saved.JobParts).PartName);
    }

    [Fact]
    public async Task Worksheet_ReopensByAppointment_UpdatesParts_AndSurvivesBookingDeletion()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync();
        var customer = new Customer { Name = "Test", PhoneNumber = "123" };
        var vehicle = new Vehicle { Customer = customer, LicensePlate = "TEST" };
        var appointment = new Appointment { Id = 42, Vehicle = vehicle, Note = "Brake repair", StartTime = DateTime.Today, EndTime = DateTime.Today.AddHours(2) };
        db.Add(appointment); await db.SaveChangesAsync();
        db.GlobalSettings.Add(new GlobalSettings { CompanyName = "Fixture Workshop" });
        await db.SaveChangesAsync();
        var controller = new ServiceJobsController(db);
        var request = new CreateWorksheetRequest { AppointmentId = 42, VehicleId = vehicle.Id, Description = "Repair", JobParts = [new LineItemRequest { PartName = "Pads", Quantity = 2, UnitPrice = 500 }] };
        var created=Assert.IsType<CreatedAtActionResult>((await controller.CreateServiceJob(request)).Result);
        var job=Assert.IsType<ServiceJob>(created.Value);
        Assert.NotEqual(42, job.Id);
        Assert.IsType<OkObjectResult>((await controller.GetByAppointment(42)).Result);
        var input = new UpdateWorksheetRequest { Version=job.Version, Id = job.Id, Description = "Done", IsCompleted = true, JobParts = [new LineItemRequest { PartName = "New pads", Quantity = 2, UnitPrice = 600 }] };
        Assert.IsType<OkObjectResult>(await controller.UpdateServiceJob(job.Id, input));
        Assert.Equal("New pads", (await db.JobParts.SingleAsync()).PartName);
        Assert.IsType<ConflictObjectResult>(await new CustomersController(db).DeleteCustomer(customer.Id));
        Assert.IsType<NoContentResult>(await new AppointmentsController(db).DeleteAppointment(42));
        Assert.Null((await db.ServiceJobs.SingleAsync()).AppointmentId);
        Assert.Single(await db.JobParts.ToListAsync());
    }
}
