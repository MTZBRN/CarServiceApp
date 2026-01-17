using System.Text.Json.Serialization;

namespace CarServiceShop.Models;

public class JobPart
{
    public int Id { get; set; }
    
    // ÚJ MEZŐ: Cikkszám
    public string PartNumber { get; set; } = string.Empty; 

    public string PartName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public int UnitPrice { get; set; }

    public int ServiceJobId { get; set; }
    [JsonIgnore]
    public ServiceJob? ServiceJob { get; set; }
}