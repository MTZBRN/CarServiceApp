using System.Security.Claims;
using System.Text.RegularExpressions;
using CarServiceShop.Data;
using CarServiceShop.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarServiceShop.Controllers;

[ApiController, Authorize]
public sealed class ProfileImagesController(ApplicationDbContext db, ProfileImages images) : ControllerBase
{
    // Keep legacy paths protected too: old links must never become a public bypass.
    [HttpGet("/api/ProfileImages/{**name}"), HttpHead("/api/ProfileImages/{**name}")]
    [HttpGet("/uploads/{**name}"), HttpHead("/uploads/{**name}")]
    public async Task<IActionResult> Get(string? name, CancellationToken cancellationToken)
    {
        var match = Regex.Match(name ?? "", @"\Aprofile_([1-9][0-9]*)_[a-zA-Z0-9]+\.(png|jpg|jpeg)\z");
        if (!match.Success || !int.TryParse(match.Groups[1].Value, out var ownerId)) return NotFound();
        if (!User.IsInRole("admin") && User.FindFirstValue(ClaimTypes.NameIdentifier) != ownerId.ToString())
            return NotFound();
        // A valid filename is not an access grant: only the account's current image is served.
        if (!await db.Users.AnyAsync(u => u.Id == ownerId && u.ProfilePicturePath == name, cancellationToken))
            return NotFound();
        var path = Path.Combine(images.DirectoryPath, name!);
        try {
            if ((System.IO.File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) return NotFound();
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
            // No ETag, Last-Modified, conditional caching or range processing for private images.
            return File(stream, match.Groups[2].Value == "png" ? "image/png" : "image/jpeg");
        }
        catch (FileNotFoundException) { return NotFound(); }
        catch (DirectoryNotFoundException) { return NotFound(); }
    }
}
