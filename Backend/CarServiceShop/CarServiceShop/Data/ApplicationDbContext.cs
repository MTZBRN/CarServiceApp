using Microsoft.EntityFrameworkCore;
using CarServiceShop.Models;

namespace CarServiceShop.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Customer> Customers { get; set; }
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<ServiceJob> ServiceJobs { get; set; }
    public DbSet<JobPart> JobParts { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
        
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
            
        // Egyedi rendszám beállítása
        modelBuilder.Entity<Vehicle>()
            .HasIndex(v => v.LicensePlate)
            .IsUnique();
    }
    
}