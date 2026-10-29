using System.Security.Cryptography;
using System.Text;

namespace CarServiceShop.Security;

// Fixed-size stripes prevent attacker-controlled usernames from growing an unbounded partition cache.
// Account counters expire after a minute; no persistent account lockout.
public sealed class LoginThrottle
{
    private readonly object gate = new();
    private readonly (DateTime Until, int Count)[] accounts = new (DateTime, int)[8192];
    private int active;
    public bool Enter(string name)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(name.Trim().ToUpperInvariant()));
        int index = BitConverter.ToUInt16(digest) % accounts.Length;
        lock (gate)
        {
            var now = DateTime.UtcNow;
            if (accounts[index].Until <= now) accounts[index] = (now.AddMinutes(1), 0);
            if (accounts[index].Count >= 10 || active >= 4) return false;
            accounts[index].Count++;
            active++;
            return true;
        }
    }
    public void Exit(string name, bool success) {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(name.Trim().ToUpperInvariant()));
        lock (gate) {
            active--;
            if (success) accounts[BitConverter.ToUInt16(digest) % accounts.Length].Count = 0;
        }
    }
}

