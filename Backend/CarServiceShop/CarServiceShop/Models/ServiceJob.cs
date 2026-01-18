using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations.Schema; // Ez kell a ForeignKey miatt

namespace CarServiceShop.Models;

public class ServiceJob
{
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

    public List<JobPart> JobParts { get; set; } = new();
}