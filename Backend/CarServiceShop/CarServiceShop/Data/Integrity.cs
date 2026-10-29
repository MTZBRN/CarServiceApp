using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;

namespace CarServiceShop.Data;

public interface IVersioned { string Version { get; set; } }
public static class Integrity
{
    // Matches SQLite upper(trim(Email)): ASCII case folding and surrounding U+0020 spaces only.
    public static string NormalizeLogin(string value) => new(value.Trim(' ').Select(c=>c is >= 'a' and <= 'z' ? (char)(c-32) : c).ToArray());
    public const string Conflict = "A rekord időközben megváltozott. Töltsd újra az adatokat, majd próbáld újra.";
    public static bool Constraint(DbUpdateException ex) => ex.InnerException is SqliteException { SqliteErrorCode:19 };
}
