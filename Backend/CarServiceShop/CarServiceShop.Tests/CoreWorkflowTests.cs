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
        var customer = new Customer { Name = "Customer", PhoneNumber = "123" };
        var vehicle = new Vehicle { Customer = customer, LicensePlate = "TEST" };
        var appointment = new Appointment { Vehicle = vehicle, Note = "Oil change", StartTime = DateTime.Today, EndTime = DateTime.Today.AddHours(1) };
        var job = new ServiceJob { Vehicle = vehicle, Appointment = appointment, Description = "Historical job", JobParts = [new JobPart { PartName = "Oil", Quantity = 1, UnitPrice = 100 }] };
        db.Add(job);
        await db.SaveChangesAsync();
        await db.Database.MigrateAsync();
        db.ChangeTracker.Clear();
        // Exercise the database FK itself, independently of controller detachment.
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM Appointments WHERE Id = {appointment.Id}");
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
        var controller = new ServiceJobsController(db);
        var job = new ServiceJob { AppointmentId = 42, VehicleId = vehicle.Id, Description = "Repair", JobParts = [new JobPart { PartName = "Pads", Quantity = 2, UnitPrice = 500 }] };
        Assert.IsType<CreatedAtActionResult>((await controller.CreateServiceJob(job)).Result);
        Assert.NotEqual(42, job.Id);
        Assert.IsType<OkObjectResult>((await controller.GetByAppointment(42)).Result);
        var input = new ServiceJob { Id = job.Id, Description = "Done", IsCompleted = true, JobParts = [new JobPart { Id = job.JobParts[0].Id, PartName = "New pads", Quantity = 2, UnitPrice = 600 }] };
        Assert.IsType<NoContentResult>(await controller.UpdateServiceJob(job.Id, input));
        Assert.Equal("New pads", (await db.JobParts.SingleAsync()).PartName);
        Assert.IsType<ConflictObjectResult>(await new CustomersController(db).DeleteCustomer(customer.Id));
        Assert.IsType<NoContentResult>(await new AppointmentsController(db).DeleteAppointment(42));
        Assert.Null((await db.ServiceJobs.SingleAsync()).AppointmentId);
        Assert.Single(await db.JobParts.ToListAsync());
    }
}
