using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) {
        if (Database.IsSqlite()) ((Microsoft.Data.Sqlite.SqliteConnection)Database.GetDbConnection())
            .CreateFunction<string?, string>("workshop_fold", Requests.CollectionReads.Fold, isDeterministic: true);
    }

    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<ServiceJob> ServiceJobs { get; set; }
    public DbSet<JobPart> JobParts { get; set; }
    public DbSet<Part> Parts { get; set; }
    public DbSet<User> Users { get; set; }
    
    public DbSet<GlobalSettings> GlobalSettings { get; set; }

    private void StampVersions() {
        foreach(var entry in ChangeTracker.Entries<IVersioned>().Where(e=>e.State==EntityState.Modified))
            entry.Entity.Version=Guid.NewGuid().ToString("N");
    }
    public override int SaveChanges(bool acceptAllChangesOnSuccess) { StampVersions(); return base.SaveChanges(acceptAllChangesOnSuccess); }
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken=default) {
        StampVersions(); return base.SaveChangesAsync(acceptAllChangesOnSuccess,cancellationToken);
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDbFunction(typeof(Requests.CollectionReads).GetMethod(nameof(Requests.CollectionReads.Fold))!).HasName("workshop_fold");
        modelBuilder.Entity<User>().Property(u=>u.NormalizedLogin).HasComputedColumnSql("upper(trim(Email))", stored: false);
        modelBuilder.Entity<User>().HasIndex(u=>u.NormalizedLogin).IsUnique();
        modelBuilder.Entity<ServiceJob>().Property(j=>j.Version).IsConcurrencyToken();
        modelBuilder.Entity<Appointment>().Property(j=>j.Version).IsConcurrencyToken();
        modelBuilder.Entity<Part>().Property(j=>j.Version).IsConcurrencyToken();
        modelBuilder.Entity<GlobalSettings>().Property(j=>j.Version).IsConcurrencyToken();
        // 1 Időpont -> 1 Munkalap (Opcionális)
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.ServiceJob)
            .WithOne(s => s.Appointment)
            .HasForeignKey<ServiceJob>(s => s.AppointmentId)
            .OnDelete(DeleteBehavior.SetNull); // Preserve service history

        // 1 Munkalap -> Sok Alkatrész
        modelBuilder.Entity<JobPart>()
            .HasOne(p => p.ServiceJob)
            .WithMany(j => j.JobParts)
            .HasForeignKey(p => p.ServiceJobId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
