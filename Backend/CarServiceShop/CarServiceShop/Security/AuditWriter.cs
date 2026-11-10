using System.Security.Claims;
using System.Text.Json;
using CarServiceShop.Data;
using CarServiceShop.Models;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Security;

public enum SecurityAuditAction { PasswordChanged, ProfileImageChanged }
public sealed class AuditPersistenceException(Exception inner) : Exception("Required audit persistence failed.",inner);

// Explicit application operations call this writer. Raw EF maintenance/fixture operations are not inferred as business actions.
public sealed class AuditWriter(IHttpContextAccessor? accessor=null)
{
    private CancellationToken Cancellation(CancellationToken token) => token==default ? accessor?.HttpContext?.RequestAborted??default : token;
    public static string Clean(string? value,int length) { var clean=string.Concat((value??"").Where(c=>!char.IsControl(c))).Trim();return clean[..Math.Min(clean.Length,length)]; }

    public AuditEvent Create(string action,string resource,int? id,string details="{}",User? resolvedActor=null,bool failure=false,bool system=false)
    {
        if(action.Length>64 || resource.Length>32 || details.Length>2048 || id<=0 ||
            !System.Text.RegularExpressions.Regex.IsMatch(action,"^[A-Za-z.]+$") || !System.Text.RegularExpressions.Regex.IsMatch(resource,"^[A-Za-z]+$")) throw new InvalidOperationException("Audit bounds exceeded.");
        var claims=accessor?.HttpContext?.User;
        return new AuditEvent {
            TimestampUtc=DateTime.UtcNow, ActorUserId=system?null:resolvedActor?.Id??(int.TryParse(claims?.FindFirstValue(ClaimTypes.NameIdentifier),out var actor)?actor:null),
            ActorName=system?"System":Clean(resolvedActor?.Name??claims?.FindFirstValue(ClaimTypes.Name),200),
            ActorRole=system?"system":Clean(resolvedActor?.Role??claims?.FindFirstValue(ClaimTypes.Role),16),
            Action=action,ResourceType=resource,ResourceId=id,Outcome=failure?"Failure":"Success",Details=details,
            TraceId=Clean(accessor?.HttpContext?.TraceIdentifier,64)
        };
    }

    // The only stored values are selected scalar operational deltas. Textual personal/business fields contribute names only.
    private static (string Action,string Type,string Details) Describe(ApplicationDbContext db,object target)
    {
        db.ChangeTracker.DetectChanges();var entry=db.Entry(target);
        var type=target switch {Customer=>"Customer",Vehicle=>"Vehicle",Appointment=>"Appointment",ServiceJob=>"Worksheet",Part=>"Inventory",User=>"User",GlobalSettings=>"Settings",_=>throw new InvalidOperationException("Unsupported audited resource.")};
        string[] fields=target switch {
            Customer=>["Name","PhoneNumber","Email","Address"], Vehicle=>["CustomerId","LicensePlate","Make","Model","Year","VIN","MOTExpiry"],
            Appointment=>["VehicleId","StartTime","EndTime","Note"],
            ServiceJob=>["Description","LaborCost","IsCompleted","AppointmentId","OdometerKm","PowertrainCode"],
            Part=>["Name","PartNumber","StockQuantity","NetPrice","GrossPrice"],User=>["Name","Email","Role"],
            GlobalSettings=>["CompanyName","Address","TaxNumber","Phone","Email","HourlyRate","VatRate"],_=>[]};
        var changed=fields.Where(f=>entry.State!=EntityState.Modified || entry.Property(f).IsModified).ToList();
        var deltas=new Dictionary<string,object?>();
        foreach(var name in changed.Where(f=>f is "CustomerId" or "VehicleId" or "StartTime" or "EndTime" or "LaborCost" or "IsCompleted" or "AppointmentId" or "StockQuantity" or "NetPrice" or "GrossPrice" or "HourlyRate" or "VatRate" or "Role")) {
            var property=entry.Property(name);
            deltas[name]=new {before=entry.State==EntityState.Added?null:property.OriginalValue,after=entry.State==EntityState.Deleted?null:property.CurrentValue};
        }
        var action=entry.State switch {EntityState.Added=>"Created",EntityState.Deleted=>"Deleted",_=>"Updated"};
        if(target is ServiceJob job){
            var lines=db.ChangeTracker.Entries<JobPart>().Where(p=>p.Entity.ServiceJobId==job.Id || job.JobParts.Contains(p.Entity)).ToList();
            if(lines.Any(p=>p.State is EntityState.Added or EntityState.Deleted or EntityState.Modified)) changed.Add("LineItems");
            if(entry.State==EntityState.Modified){
                var was=entry.Property("IsCompleted").OriginalValue is true;
                action=was!=job.IsCompleted?(job.IsCompleted?"Completed":"Reopened"):was?"CompletedCorrected":changed.SequenceEqual(new[]{"LineItems"})?"LineItemAdded":"Updated";
                deltas["IsCompleted"]=new {before=was,after=job.IsCompleted};
            }
        }
        return ($"{type}.{action}",type,JsonSerializer.Serialize(new {fields=changed.Take(16),changes=deltas}));
    }

    public async Task SaveAsync(ApplicationDbContext db,object target,SecurityAuditAction? security=null,CancellationToken cancellationToken=default)
    {
        var ct=Cancellation(cancellationToken);
        var description=security.HasValue?($"Auth.{security}","User","{}"):Describe(db,target);
        await using var transaction=db.Database.CurrentTransaction==null?await db.Database.BeginTransactionAsync(ct):null;
        await db.SaveChangesAsync(ct);
        var id=(int)db.Entry(target).Property("Id").CurrentValue!;
        // No entity/request serialization. Values and keys in description come exclusively from the allowlist above.
        var item=Create(description.Item1,description.Item2,id,description.Item3);
        await AppendAsync(db,item,ct);
        if(transaction!=null)await transaction.CommitAsync(ct);
    }

    public async Task AppendAsync(ApplicationDbContext db,AuditEvent item,CancellationToken cancellationToken=default)
    {
        db.AuditEvents.Add(item);
        try {await db.SaveChangesAsync(Cancellation(cancellationToken));}
        catch(DbUpdateException error){throw new AuditPersistenceException(error);}
    }
    public void Append(ApplicationDbContext db,AuditEvent item)
    {
        db.AuditEvents.Add(item);
        try {db.SaveChanges();}catch(DbUpdateException error){throw new AuditPersistenceException(error);}
    }
}

// Constant memory; no attacker-chosen identifiers. At most one failure/minute and 20/hour per process, across all sources/accounts.
public sealed class AuditFailureBudget
{
    private readonly object gate=new();private DateTime next,window;private int count;
    public bool Take(){lock(gate){var now=DateTime.UtcNow;if(now>=window.AddHours(1)){window=now;count=0;}if(now<next||count>=20)return false;next=now.AddMinutes(1);count++;return true;}}
}
