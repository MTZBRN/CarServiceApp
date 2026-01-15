using System.Text.Json.Serialization;

namespace CarServiceShop.Models;

public class Vehicle
{
    public int Id { get; set; }
    public string LicensePlate { get; set; } = string.Empty; // Rendszám
    public string Make { get; set; } = string.Empty; // Márka (pl. Ford)
    public string Model { get; set; } = string.Empty; // Típus (pl. Focus)
    public int Year { get; set; }
    public string? VIN { get; set; } // Alvázszám (opcionális)

    // ITT AZ ÚJ MEZŐ: Műszaki vizsga lejárata
    public DateTime? TechnicalExamExpiry { get; set; }

    // Külső kulcs a tulajdonoshoz
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // Kapcsolatok
    [JsonIgnore]
    public List<ServiceJob> ServiceJobs { get; set; } = new(); // Szerviztörténet
        
    [JsonIgnore]
    public List<Appointment> Appointments { get; set; } = new(); // Naptár bejegyzések
}