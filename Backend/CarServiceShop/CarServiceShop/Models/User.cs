namespace CarServiceShop.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonIgnore]
    public string NormalizedLogin { get; private set; } = "";
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string SessionVersion { get; set; } = "initial";
    public string? ProfilePicturePath { get; set; }
}