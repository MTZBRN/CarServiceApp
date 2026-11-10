using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using CarServiceShop.Models;

namespace CarServiceShop.Requests;

public class CollectionQuery : IValidatableObject
{
    [Range(1, 100000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 50;
    [StringLength(200)] public string? Q { get; set; }
    [StringLength(100)] public string? PartNumber { get; set; }
    [Range(1, int.MaxValue)] public int? CustomerId { get; set; }
    [Range(1, int.MaxValue)] public int? VehicleId { get; set; }
    [Range(1, int.MaxValue)] public int? AppointmentId { get; set; }
    [RegularExpression("^(open|completed)$")] public string? Status { get; set; }
    [RegularExpression("^(valid|soon|expired|missing|invalid)$")] public string? Inspection { get; set; }
    [RegularExpression("^(out|low|available|invalid)$")] public string? Stock { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public DateTime? MotFrom { get; set; }
    public DateTime? MotTo { get; set; }
    public DateTime? Start { get; set; }
    public DateTime? End { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        foreach (var date in new[] { From, To, MotFrom, MotTo, Start, End })
            if (date.HasValue && !InputRules.Date(date.Value)) yield return new("Dates must be between 1900 and 2100.");
        if (From > To || MotFrom > MotTo) yield return new("Reversed date range.");
        if (Start.HasValue != End.HasValue || Start >= End || (End - Start)?.TotalDays > 93)
            yield return new("Supply start/end in order, at most 93 days apart.");
    }
}

public static class CollectionReads
{
    // Registered as a deterministic SQLite function; unlike SQLite lower(), this preserves Hungarian case-insensitive search.
    public static string Fold(string? text) => (text ?? "").ToLowerInvariant();
    public static async Task<List<T>> PageAsync<T>(IQueryable<T> orderedQuery, CollectionQuery query, HttpContext? context, CancellationToken cancellationToken)
    {
        var count = await orderedQuery.CountAsync(cancellationToken);
        if (context != null) {
            context.Response.Headers["X-Total-Count"] = count.ToString(System.Globalization.CultureInfo.InvariantCulture);
            context.Response.Headers["X-Page"] = query.Page.ToString(System.Globalization.CultureInfo.InvariantCulture);
            context.Response.Headers["X-Page-Size"] = query.PageSize.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        if(count==0 || query.Page>1+(count-1)/query.PageSize) return [];
        return await orderedQuery.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
    }

    public static IQueryable<Vehicle> Vehicles(IQueryable<Vehicle> source, CollectionQuery query)
    {
        var q = Fold(query.Q?.Trim());
        if (q.Length > 0) source = source.Where(v => Fold(v.LicensePlate + " " + v.Make + " " + v.Model + " " + v.Customer!.Name).Contains(q));
        if (query.CustomerId.HasValue) source = source.Where(v => v.CustomerId == query.CustomerId);
        if (query.MotFrom.HasValue) source = source.Where(v => v.MOTExpiry >= query.MotFrom);
        if (query.MotTo.HasValue) source = source.Where(v => v.MOTExpiry < query.MotTo);
        var today = DateTime.Today; var soon = today.AddDays(31);
        return query.Inspection switch {
            "expired" => source.Where(v => v.MOTExpiry < today),
            "soon" => source.Where(v => v.MOTExpiry >= today && v.MOTExpiry < soon),
            "valid" => source.Where(v => v.MOTExpiry >= soon),
            "missing" => source.Where(v => v.MOTExpiry == null),
            "invalid" => source.Where(v => v.MOTExpiry != null && (v.MOTExpiry < new DateTime(1900,1,1) || v.MOTExpiry >= new DateTime(2101,1,1))),
            _ => source
        };
    }

    public static IQueryable<ServiceJob> Jobs(IQueryable<ServiceJob> source, CollectionQuery query)
    {
        var q = Fold(query.Q?.Trim());
        if (q.Length > 0) source = source.Where(j => Fold(j.Id.ToString() + " " + j.Description + " " + j.Vehicle!.LicensePlate + " " + j.Vehicle.Make + " " + j.Vehicle.Model + " " + j.Vehicle.Customer!.Name).Contains(q));
        if (query.VehicleId.HasValue) source = source.Where(j => j.VehicleId == query.VehicleId);
        if (query.AppointmentId.HasValue) source = source.Where(j => j.AppointmentId == query.AppointmentId);
        if (query.Status != null) source = source.Where(j => j.IsCompleted == (query.Status == "completed"));
        if (query.From.HasValue) source = source.Where(j => j.Date >= query.From);
        if (query.To.HasValue) { var end = query.To.Value.Date.AddDays(1); source = source.Where(j => j.Date < end); }
        return source;
    }

    public static IQueryable<WorksheetRow> JobRows(IQueryable<ServiceJob> source) => source.Select(j => new WorksheetRow {
        Id=j.Id, Version=j.Version, AppointmentId=j.AppointmentId, VehicleId=j.VehicleId, Date=j.Date,
        Description=j.Description, LaborCost=j.LaborCost, IsCompleted=j.IsCompleted,
        OdometerKm=j.OdometerKm, PowertrainCode=j.PowertrainCode,
        Vehicle=j.Vehicle == null ? null : new Vehicle { Id=j.Vehicle.Id, LicensePlate=j.Vehicle.LicensePlate, Make=j.Vehicle.Make,
            Model=j.Vehicle.Model, Year=j.Vehicle.Year, MOTExpiry=j.Vehicle.MOTExpiry, CustomerId=j.Vehicle.CustomerId, Customer=j.Vehicle.Customer },
        PartsTotal=j.JobParts.Sum(p => (long)p.Quantity * p.UnitPrice),
        LineItemCount=j.JobParts.Count,
        // A list page never expands an unbounded child collection. Full saved detail/print uses the existing item endpoint.
        JobParts=j.JobParts.OrderBy(p => p.Id).Take(20).Select(p => new JobPart { Id=p.Id, PartNumber=p.PartNumber, PartName=p.PartName, Quantity=p.Quantity, UnitPrice=p.UnitPrice }).ToList()
    });

    public static IQueryable<Appointment> Bookings(IQueryable<Appointment> source, CollectionQuery query)
    {
        var start = query.Start ?? DateTime.Today.AddDays(-7);
        var end = query.End ?? DateTime.Today.AddDays(35);
        // Overlap, rather than only starting in the range, retains multi-day bookings.
        source = source.Where(a => a.StartTime < end && a.EndTime >= start);
        if (query.VehicleId.HasValue) source = source.Where(a => a.VehicleId == query.VehicleId);
        return source;
    }
}

public class WorksheetRow
{
    public int? OdometerKm { get; set; }
    public string? PowertrainCode { get; set; }
    public int Id { get; set; }
    public string Version { get; set; } = "";
    public int? AppointmentId { get; set; }
    public int VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public DateTime Date { get; set; }
    public string Description { get; set; } = "";
    public int LaborCost { get; set; }
    public bool IsCompleted { get; set; }
    public long PartsTotal { get; set; }
    public int LineItemCount { get; set; }
    public List<JobPart> JobParts { get; set; } = [];
}
