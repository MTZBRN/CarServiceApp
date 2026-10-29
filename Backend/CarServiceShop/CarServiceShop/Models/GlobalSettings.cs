namespace CarServiceShop.Models;

public class GlobalSettings : CarServiceShop.Data.IVersioned
{
    public string Version { get; set; } = Guid.NewGuid().ToString("N");
    public int Id { get; set; } // Mindig 1-es lesz az ID-ja, mert csak egy sor kell
    public string CompanyName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    
    // Pénzügyi adatok
    public decimal HourlyRate { get; set; } = 15000;
    public int VatRate { get; set; } = 27;
}