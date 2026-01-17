using System.Text.Json.Serialization;

namespace CarServiceShop.Models;

public class ServiceJob
{
    public int Id { get; set; }
    
    // Melyik időponthoz tartozik?
    public int AppointmentId { get; set; }
    [JsonIgnore] // Hogy ne legyen körkörös hivatkozás
    public Appointment? Appointment { get; set; }

    public string Description { get; set; } = string.Empty; // Pl. "Fékcsere elvégezve"
    public int LaborCost { get; set; } // Munkadíj (Forintban)
    public bool IsCompleted { get; set; } = false; // Kész van-e?

    // Egy munkalaphoz sok alkatrész tartozhat
    public List<JobPart> JobParts { get; set; } = new();
}