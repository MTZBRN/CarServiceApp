using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<ServiceJob> ServiceJobs { get; set; }
    public DbSet<JobPart> JobParts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 1 Időpont -> 1 Munkalap (Opcionális)
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.ServiceJob)
            .WithOne(s => s.Appointment)
            .HasForeignKey<ServiceJob>(s => s.AppointmentId)
            .OnDelete(DeleteBehavior.Cascade); // Ha törlöd az időpontot, törlődik a munkalap is

        // 1 Munkalap -> Sok Alkatrész
        modelBuilder.Entity<JobPart>()
            .HasOne(p => p.ServiceJob)
            .WithMany(j => j.JobParts)
            .HasForeignKey(p => p.ServiceJobId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}