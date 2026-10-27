using CarServiceShop.Controllers;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
using Xunit;

namespace CarServiceShop.Tests;

public class UsersControllerTests
{
    // A [Fact] jelzi, hogy ez egy teszt metódus
    [Fact]
    public async Task AddUser_ReturnsOk_WhenEmailIsUnique()
    {
        // 1. ARRANGE (Előkészítés)
        // Létrehozunk egy memóriabeli adatbázist a teszthez
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()) // Egyedi név, hogy ne akadjanak össze a tesztek
            .Options;

        // Létrehozzuk az adatbázis kontextust és a kontrollert
        using var context = new ApplicationDbContext(options);
        var controller = new UsersController(context);

        // Összerakjuk a tesztadatot (a DTO-t, amit a React is küldene)
        var newUserDto = new CreateUserDto
        {
            Name = "Teszt Elek",
            Email = "tesztelek@teszt.com",
            Password = "TitkosJelszo123!",
            Role = "admin"
        };

        // 2. ACT (Cselekvés)
        // Meghívjuk a regisztrációs végpontot
        var result = await controller.AddUser(newUserDto);

        // 3. ASSERT (Ellenőrzés)
        // Ellenőrizzük, hogy a válasz tényleg OkObjectResult (200 OK) lett-e
        Assert.IsType<OkObjectResult>(result);

        // Bónusz: Ellenőrizzük, hogy bekerült-e az adatbázisba
        var userInDb = await context.Users.FirstOrDefaultAsync(u => u.Email == "tesztelek@teszt.com");
        Assert.NotNull(userInDb);
        Assert.Equal("Teszt Elek", userInDb.Name);
    }

    [Fact]
    public async Task AddUser_ReturnsOk_WhenRoleIsMechanic()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new ApplicationDbContext(options);
        var controller = new UsersController(context);
        var newUserDto = new CreateUserDto
        {
            Name = "Teszt Szerelő",
            Email = "szerelo@teszt.com",
            Password = "TitkosJelszo123!",
            Role = "mechanic"
        };

        var result = await controller.AddUser(newUserDto);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("mechanic", (await context.Users.SingleAsync()).Role);
    }
}