using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, CarServiceShop.Security.AuditWriter? audit=null) : base(options) {
        Audit=audit??new CarServiceShop.Security.AuditWriter();
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
    public DbSet<CarServiceShop.Security.WorkshopSession> Sessions { get; set; }
    public DbSet<AuditEvent> AuditEvents { get; set; }
    public CarServiceShop.Security.AuditWriter Audit { get; }
    public Task SaveAuditedAsync(object target,CarServiceShop.Security.SecurityAuditAction? action=null,CancellationToken cancellationToken=default) => Audit.SaveAsync(this,target,action,cancellationToken);
    
    public DbSet<GlobalSettings> GlobalSettings { get; set; }

    private void StampVersions() {
        if(ChangeTracker.Entries<AuditEvent>().Any(e=>e.State is EntityState.Modified or EntityState.Deleted)) throw new InvalidOperationException("Audit events are append-only.");
        foreach(var entry in ChangeTracker.Entries<IVersioned>().Where(e=>e.State==EntityState.Modified))
            entry.Entity.Version=Guid.NewGuid().ToString("N");
    }
    public override int SaveChanges(bool acceptAllChangesOnSuccess) { StampVersions(); return base.SaveChanges(acceptAllChangesOnSuccess); }
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken=default) {
        StampVersions(); return base.SaveChangesAsync(acceptAllChangesOnSuccess,cancellationToken);
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var audit=modelBuilder.Entity<AuditEvent>();
        modelBuilder.Entity<CarServiceShop.Security.WorkshopSession>().HasIndex(s => s.IdleUntil);
        audit.Property(e=>e.TimestampUtc).HasConversion(v=>v,v=>DateTime.SpecifyKind(v,DateTimeKind.Utc));
        audit.Property(e=>e.ActorName).HasMaxLength(200);audit.Property(e=>e.ActorRole).HasMaxLength(16);
        audit.Property(e=>e.Action).HasMaxLength(64);audit.Property(e=>e.ResourceType).HasMaxLength(32);
        audit.Property(e=>e.Outcome).HasMaxLength(16);audit.Property(e=>e.Details).HasMaxLength(2048);audit.Property(e=>e.TraceId).HasMaxLength(64);
        audit.HasIndex(e=>new {e.TimestampUtc,e.Id});audit.HasIndex(e=>new {e.ActorUserId,e.TimestampUtc});audit.HasIndex(e=>new {e.ResourceType,e.ResourceId,e.TimestampUtc});
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
