using System.Security.Claims;
using CarServiceShop.Data;
using CarServiceShop.Models;

namespace CarServiceShop.Security;

public sealed class WorkshopSession
{
    public const string Claim = "workshop_session";
    public const long IdleMilliseconds = 15 * 60 * 1000;
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public long IdleUntil { get; set; }
    public long AbsoluteUntil { get; set; }

    public static IQueryable<WorkshopSession> Active(ApplicationDbContext db, ClaimsPrincipal principal, long now)
    {
        var sessionId = principal.FindFirstValue(Claim);
        var version = principal.FindFirstValue("session_version");
        var role = principal.FindFirstValue(ClaimTypes.Role);
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId);
        return db.Sessions.Where(s => s.Id == sessionId && s.UserId == userId &&
            s.User.SessionVersion == version && s.User.Role == role &&
            s.IdleUntil > now && s.AbsoluteUntil > now);
    }
}
