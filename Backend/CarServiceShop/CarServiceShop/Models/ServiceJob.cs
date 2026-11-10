using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations.Schema; // Ez kell a ForeignKey miatt

namespace CarServiceShop.Models;

[JsonConverter(typeof(JsonStringEnumConverter<CompanyHistory>))]
public enum CompanyHistory { Pending, Captured, HistoricalUnavailable }

public sealed record CompanySnapshot(string CompanyName, string Address, string Phone,
    string Email, string TaxNumber, string SettingsVersion, DateTime CapturedAtUtc);

public class ServiceJob : CarServiceShop.Data.IVersioned
{
    public string Version { get; set; } = Guid.NewGuid().ToString("N");
    public int Id { get; set; }
    
    // --- MÓDOSÍTÁS: Legyen opcionális (int?) az időpont, ha csak úgy beesik valaki ---
    public int? AppointmentId { get; set; }
    
    [JsonIgnore]
    public Appointment? Appointment { get; set; }

    // --- ÚJ MEZŐK (Hogy a Dashboard működjön) ---
    public int VehicleId { get; set; } // Tudnunk kell, melyik autót szereljük!
    
    // (Opcionális: Ha vissza akarjuk küldeni a Jármű adatait is, kiveheted a JsonIgnore-t, ha kell)
    [JsonIgnore] 
    public Vehicle? Vehicle { get; set; }

    public DateTime Date { get; set; } = DateTime.Now; // Mikor végezzük a munkát?

    // --- MEGLÉVŐK ---
    public string Description { get; set; } = string.Empty;
    public int LaborCost { get; set; }
    public bool IsCompleted { get; set; } = false;
    public int? OdometerKm { get; set; }
    public string? PowertrainCode { get; set; }
    public CompanyHistory CompanyHistory { get; internal set; } = CompanyHistory.Pending;
    public CompanySnapshot? CompanySnapshot { get; private set; }

    public void CaptureCompany(GlobalSettings settings)
    {
        if (CompanyHistory != CompanyHistory.Pending)
            throw new InvalidOperationException("Worksheet company history is already settled.");
        CompanySnapshot = new(settings.CompanyName, settings.Address, settings.Phone,
            settings.Email, settings.TaxNumber, settings.Version, DateTime.UtcNow);
        CompanyHistory = CompanyHistory.Captured;
    }

    public List<JobPart> JobParts { get; set; } = new();
}
