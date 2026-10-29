namespace CarServiceShop.Models;

public class Part : CarServiceShop.Data.IVersioned
{
    public string Version { get; set; } = Guid.NewGuid().ToString("N");
    public int Id { get; set; }
    public string PartNumber { get; set; } = string.Empty; // Cikkszám (UNIX)
    public string Name { get; set; } = string.Empty;       // Megnevezés
    public int NetPrice { get; set; }                      // Nettó Ár
    public int GrossPrice { get; set; }                    // Bruttó Ár
    public int StockQuantity { get; set; }                 // Készlet (db)
}