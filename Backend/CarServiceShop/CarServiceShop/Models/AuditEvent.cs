namespace CarServiceShop.Models;

// No user/resource foreign keys: history survives deletion of the referenced record.
public sealed class AuditEvent
{
    public long Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public int? ActorUserId { get; set; }
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string ResourceType { get; set; } = "";
    public int? ResourceId { get; set; }
    public string Outcome { get; set; } = "Success";
    public string Details { get; set; } = "{}";
    public string TraceId { get; set; } = "";
}
