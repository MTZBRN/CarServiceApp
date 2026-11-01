using CarServiceShop.Requests;
using CarServiceShop.Controllers;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Tests;

public class AppointmentsControllerTests
{
    [Fact]
    public async Task PostAppointment_ReturnsOkAndStoresAppointment()
    {
        using var context = CreateContext();
        var controller = new AppointmentsController(context);
        var appointment = CreateAppointment();

        var result = await controller.PostAppointment(ToRequest(appointment));

        var response = Assert.IsType<OkObjectResult>(result.Result);
        var saved=Assert.IsType<Appointment>(response.Value);
        appointment.Id=saved.Id;
        Assert.Equal(appointment.Note,saved.Note);
        Assert.NotEqual(0, appointment.Id);
        Assert.Equal(appointment.Note, await context.Appointments
            .Where(a => a.Id == appointment.Id)
            .Select(a => a.Note)
            .SingleAsync());
    }

    [Fact]
    public async Task GetAppointment_ReturnsStoredAppointment()
    {
        using var context = CreateContext();
        context.Vehicles.Remove(context.Vehicles.Find(1)!);
        context.Vehicles.Add(new Vehicle
        {
            Id = 1,
            LicensePlate = "ABC-123",
            Make = "Ford",
            Model = "Focus",
            Year = 2020,
            CustomerId = 1
        });
        var appointment = CreateAppointment();
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();
        var controller = new AppointmentsController(context);

        var result = await controller.GetAppointment(appointment.Id);

        var response = Assert.IsType<OkObjectResult>(result.Result);
        var returnedAppointment = Assert.IsType<Appointment>(response.Value);
        Assert.Equal(appointment.Id, returnedAppointment.Id);
        Assert.Equal(appointment.Note, returnedAppointment.Note);
    }

    [Fact]
    public async Task PutAppointment_UpdatesStoredAppointment()
    {
        using var context = CreateContext();
        var appointment = CreateAppointment();
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();
        var controller = new AppointmentsController(context);
        var updatedAppointment = new Appointment
        {
            Version=appointment.Version, Id = appointment.Id,
            StartTime = appointment.StartTime.AddHours(1),
            EndTime = appointment.EndTime.AddHours(1),
            Note = "Módosított megjegyzés",
            VehicleId = appointment.VehicleId
        };

        var result = await controller.PutAppointment(appointment.Id, ToRequest(updatedAppointment));

        Assert.IsType<OkObjectResult>(result);
        var appointmentInDb = await context.Appointments.FindAsync(appointment.Id);
        Assert.NotNull(appointmentInDb);
        Assert.Equal(updatedAppointment.StartTime, appointmentInDb.StartTime);
        Assert.Equal(updatedAppointment.Note, appointmentInDb.Note);
    }

    [Fact]
    public async Task DeleteAppointment_RemovesStoredAppointment()
    {
        using var context = CreateContext();
        var appointment = CreateAppointment();
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();
        var controller = new AppointmentsController(context);

        var result = await controller.DeleteAppointment(appointment.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await context.Appointments.FindAsync(appointment.Id));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PutAppointment_VehicleChangeRespectsWorksheet(bool linked)
    {
        using var context = CreateContext();
        var appointment = CreateAppointment();
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();
        if (linked) {
            context.ServiceJobs.Add(new ServiceJob { VehicleId = 1, AppointmentId = appointment.Id, Description = "Existing job" });
            await context.SaveChangesAsync();
        }
        var result = await new AppointmentsController(context).PutAppointment(appointment.Id,
            new AppointmentRequest { Version=appointment.Version, Id = appointment.Id, VehicleId = 2, StartTime = appointment.StartTime, EndTime = appointment.EndTime, Note = "Updated" });
        if (linked) {
            Assert.IsType<ConflictObjectResult>(result);
            Assert.Equal(1, appointment.VehicleId);
            Assert.Equal("Olajcsere", appointment.Note);
        } else {
            Assert.IsType<OkObjectResult>(result);
            Assert.Equal(2, appointment.VehicleId);
        }
    }

    [Fact]
    public async Task PutAppointment_LinkedNoteEditPreservesTimesAndRelationship()
    {
        using var context = CreateContext();
        var appointment = CreateAppointment();
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();
        context.ServiceJobs.Add(new ServiceJob { VehicleId = 1, AppointmentId = appointment.Id, Description = "Existing job" });
        await context.SaveChangesAsync();
        var start = appointment.StartTime; var end = appointment.EndTime;
        var result = await new AppointmentsController(context).PutAppointment(appointment.Id,
            new AppointmentRequest { Version=appointment.Version, Id = appointment.Id, VehicleId = 1, StartTime = start, EndTime = end, Note = "New note" });
        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(start, appointment.StartTime); Assert.Equal(end, appointment.EndTime);
        Assert.Equal(appointment.Id, (await context.ServiceJobs.SingleAsync()).AppointmentId);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;

        var db=new ApplicationDbContext(options);
        db.Database.OpenConnection(); db.Database.EnsureCreated();
        db.Customers.Add(new Customer {Id=1,Name="Owner",PhoneNumber="123"});
        db.Vehicles.AddRange(new Vehicle {Id=1, CustomerId=1, LicensePlate="ONE"},new Vehicle {Id=2,CustomerId=1,LicensePlate="TWO"}); db.SaveChanges();
        return db;
    }

    private static AppointmentRequest ToRequest(Appointment a) => new() {Version=a.Version,Id=a.Id,VehicleId=a.VehicleId,StartTime=a.StartTime,EndTime=a.EndTime,Note=a.Note};
    private static Appointment CreateAppointment()
    {
        return new Appointment
        {
            StartTime = new DateTime(2026, 1, 20, 9, 0, 0),
            EndTime = new DateTime(2026, 1, 20, 10, 0, 0),
            Note = "Olajcsere",
            VehicleId = 1
        };
    }
}
