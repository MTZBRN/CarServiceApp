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

        var result = await controller.PostAppointment(appointment);

        var response = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(appointment, response.Value);
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
            Id = appointment.Id,
            StartTime = appointment.StartTime.AddHours(1),
            EndTime = appointment.EndTime.AddHours(1),
            Note = "Módosított megjegyzés",
            VehicleId = appointment.VehicleId
        };

        var result = await controller.PutAppointment(appointment.Id, updatedAppointment);

        Assert.IsType<NoContentResult>(result);
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

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

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
