namespace CarServiceShop.Models;

public class Appointment
{
    public int Id { get; set; }
        
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Note { get; set; } = string.Empty; // Megjegyzés

    // Melyik autóra foglaltak (lehet null, ha csak betelefonált, és még nincs az adatbázisban)
    public int? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    public ServiceJob? ServiceJob { get; set; }
}