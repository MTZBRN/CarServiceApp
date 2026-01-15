namespace CarServiceShop.Models;

public class ServiceJob
{
    public int Id { get; set; }
        
    // Mikor és hány kilométernél történt?
    public DateTime JobDate { get; set; } = DateTime.Now;
    public int Mileage { get; set; } // Km óra állás
        
    public string Description { get; set; } = string.Empty; // Munka leírása

    // Kapcsolat az autóval
    public int VehicleId { get; set; }
    // Itt nem kell JsonIgnore, mert ha lekéred a munkát, tudni akarod melyik autó az
    public Vehicle? Vehicle { get; set; } 

    // Felhasznált alkatrészek listája
    public List<JobPart> JobParts { get; set; } = new();
}