using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using CarServiceShop.Data;
using CarServiceShop.Models; // Ügyelj a saját namespace-edre!

public static class DbSeeder
{
    public static void SeedUsers(ApplicationDbContext context)
    {
        // 1. Ellenőrizzük, van-e már felhasználó
        if (!context.Users.Any())
        {
            // 2. Jelszó titkosítása (mint a frontenden bcrypt-tel)
            string salt = BCrypt.Net.BCrypt.GenerateSalt(10);
            string hashedPassword = BCrypt.Net.BCrypt.HashPassword("admin123", salt);

            // 3. Alapértelmezett Admin létrehozása
            var admin = new User
            {
                Name = "Fő Adminisztrátor",
                Email = "admin@test.com", // Ezt fogod beírni a Login mezőbe
                PasswordHash = hashedPassword,
                Role = "admin"
            };

            context.Users.Add(admin);
            context.SaveChanges();
            
            Console.WriteLine("--> Az alapértelmezett admin felhasználó létrehozva! (admin / admin123)");
        }
    }
}