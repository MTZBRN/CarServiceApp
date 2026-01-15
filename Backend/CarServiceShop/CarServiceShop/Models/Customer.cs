using System.Text.Json.Serialization;

namespace CarServiceShop.Models;

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty; // Fontos az értesítéshez!
    public string? Email { get; set; }
    public string? Address { get; set; }

    // N:N: Egy ügyfélnek több autója lehet
    // A JsonIgnore azért kell, hogy ne legyen végtelen ciklus a lekérdezésnél
    [JsonIgnore] 
    public List<Vehicle> Vehicles { get; set; } = new();
}