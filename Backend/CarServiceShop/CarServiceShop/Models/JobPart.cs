using System.Text.Json.Serialization;

namespace CarServiceShop.Models;

public class JobPart
{
    public int Id { get; set; }
        
    public string Name { get; set; } = string.Empty; // Pl. "Olajszűrő"
    public string PartNumber { get; set; } = string.Empty; // Cikkszám
    public double Quantity { get; set; } // Mennyiség
    public string Unit { get; set; } = "db"; // Mértékegység
    public decimal Price { get; set; } // Ár

    // Melyik munkához tartozik
    public int ServiceJobId { get; set; }
    [JsonIgnore]
    public ServiceJob? ServiceJob { get; set; }
}