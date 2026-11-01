using System.ComponentModel.DataAnnotations;
using CarServiceShop.Models;

namespace CarServiceShop.Requests;

public static class InputRules
{
    public const int MoneyMax = 100_000_000;
    public const long WorksheetTotalMax = 1_000_000_000_000L;
    public static bool Date(DateTime value) => value.Year is >= 1900 and <= 2100;
    public static bool Email(string? value) => string.IsNullOrEmpty(value) || new EmailAddressAttribute().IsValid(value);
}

public class CustomerRequest : IValidatableObject
{
    public int? Id { get; set; }
    [Required, StringLength(200)] public string Name { get; set; } = "";
    [Required, StringLength(50)] public string PhoneNumber { get; set; } = "";
    [StringLength(254)] public string? Email { get; set; }
    [StringLength(500)] public string? Address { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context) {
        if (!InputRules.Email(Email)) yield return new("Érvénytelen email cím.", [nameof(Email)]);
    }
    public Customer ToEntity() => new() { Name=Name.Trim(), PhoneNumber=PhoneNumber.Trim(), Email=Email, Address=Address };
}

public class VehicleRequest : IValidatableObject
{
    [Required, StringLength(64)] public string LicensePlate { get; set; } = "";
    [Required, StringLength(100)] public string Make { get; set; } = "";
    [Required, StringLength(100)] public string Model { get; set; } = "";
    [Range(1886,2100)] public int Year { get; set; }
    [StringLength(50)] public string? VIN { get; set; }
    public DateTime? MOTExpiry { get; set; }
    public DateTime? TechnicalExamExpiry { get; set; }
    [Range(1,int.MaxValue)] public int CustomerId { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context) {
        if ((MOTExpiry.HasValue && !InputRules.Date(MOTExpiry.Value)) || (TechnicalExamExpiry.HasValue && !InputRules.Date(TechnicalExamExpiry.Value)))
            yield return new("Érvénytelen vizsgadátum.");
    }
    public Vehicle ToEntity() => new() { LicensePlate=LicensePlate.Trim(), Make=Make.Trim(), Model=Model.Trim(), Year=Year, VIN=VIN, MOTExpiry=MOTExpiry, TechnicalExamExpiry=TechnicalExamExpiry, CustomerId=CustomerId };
}

public class AppointmentRequest : IValidatableObject
{
    [StringLength(64)] public string? Version { get; set; }
    public int? Id { get; set; }
    [Range(1,int.MaxValue)] public int VehicleId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    [StringLength(5000)] public string Note { get; set; } = "";
    public IEnumerable<ValidationResult> Validate(ValidationContext context) {
        if (!InputRules.Date(StartTime) || !InputRules.Date(EndTime) || EndTime < StartTime) yield return new("Érvénytelen kezdő/záró dátum.");
    }
    public Appointment ToEntity() => new() { VehicleId=VehicleId, StartTime=StartTime, EndTime=EndTime, Note=Note };
}

public class LineItemRequest
{
    [StringLength(100)] public string PartNumber { get; set; } = "";
    [Required, StringLength(200)] public string PartName { get; set; } = "";
    [Range(1,10000)] public int Quantity { get; set; } = 1;
    [Range(0,InputRules.MoneyMax)] public int UnitPrice { get; set; }
    public JobPart ToEntity() => new() { PartNumber=PartNumber, PartName=PartName.Trim(), Quantity=Quantity, UnitPrice=UnitPrice };
}
public class JobPartRequest : LineItemRequest
{
    [StringLength(64)] public string? Version { get; set; }
    [Range(1,int.MaxValue)] public int ServiceJobId { get; set; }
}
public class UpdateWorksheetRequest : IValidatableObject
{
    [StringLength(64)] public string? Version { get; set; }
    public int? Id { get; set; }
    [Required, StringLength(10000)] public string Description { get; set; } = "";
    [Range(0,InputRules.MoneyMax)] public int LaborCost { get; set; }
    public bool IsCompleted { get; set; }
    [Required, MaxLength(500)] public List<LineItemRequest> JobParts { get; set; } = [];
    public virtual IEnumerable<ValidationResult> Validate(ValidationContext context) {
        if (JobParts == null || JobParts.Any(p=>p==null)) { yield return new("Érvénytelen alkatrészlista."); yield break; }
        if (JobParts.Sum(p=>(decimal)p.Quantity*p.UnitPrice)+LaborCost > InputRules.WorksheetTotalMax) yield return new("A végösszeg túl nagy.");
    }
}
public class CreateWorksheetRequest : UpdateWorksheetRequest
{
    [Range(0,int.MaxValue)] public int VehicleId { get; set; }
    [Range(1,int.MaxValue)] public int? AppointmentId { get; set; }
    public DateTime? Date { get; set; }
    public override IEnumerable<ValidationResult> Validate(ValidationContext context) {
        foreach(var error in base.Validate(context)) yield return error;
        if (Date.HasValue && !InputRules.Date(Date.Value)) yield return new("Érvénytelen munkalap dátum.");
        if (VehicleId==0 && !AppointmentId.HasValue) yield return new("Jármű szükséges.");
    }
}
public class PartRequest
{
    [StringLength(64)] public string? Version { get; set; }
    public int? Id { get; set; }
    [Required, StringLength(100)] public string PartNumber { get; set; } = "";
    [Required, StringLength(200)] public string Name { get; set; } = "";
    [Range(0,InputRules.MoneyMax)] public int NetPrice { get; set; }
    [Range(0,InputRules.MoneyMax)] public int GrossPrice { get; set; }
    [Range(0,1_000_000)] public int StockQuantity { get; set; }
    public Part ToEntity() => new() { PartNumber=PartNumber.Trim(), Name=Name.Trim(), NetPrice=NetPrice, GrossPrice=GrossPrice, StockQuantity=StockQuantity };
}
public class SettingsRequest : IValidatableObject
{
    [StringLength(64)] public string? Version { get; set; }
    [StringLength(200)] public string CompanyName { get; set; } = "";
    [StringLength(500)] public string Address { get; set; } = "";
    [StringLength(50)] public string TaxNumber { get; set; } = "";
    [StringLength(50)] public string Phone { get; set; } = "";
    [StringLength(254)] public string Email { get; set; } = "";
    [Range(typeof(decimal),"0","1000000")] public decimal HourlyRate { get; set; } = 15000;
    [Range(0,100)] public int VatRate { get; set; } = 27;
    public IEnumerable<ValidationResult> Validate(ValidationContext context) {
        if (!InputRules.Email(Email)) yield return new("Érvénytelen email cím.", [nameof(Email)]);
    }
    public GlobalSettings ToEntity() => new() { CompanyName=CompanyName, Address=Address, TaxNumber=TaxNumber, Phone=Phone, Email=Email, HourlyRate=HourlyRate, VatRate=VatRate };
}
