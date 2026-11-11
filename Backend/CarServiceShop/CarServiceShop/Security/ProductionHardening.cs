using System.Reflection;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Diagnostics;

namespace CarServiceShop.Security;

public static class ProductionHardening
{
    public const string DevelopmentIssuer = "urn:carserviceapp:development";
    public const string DevelopmentAudience = "urn:carserviceapp:development-client";
    public const string ProductionCsp = "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";
    public const string DevelopmentCsp = "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http://localhost:5232; font-src 'self'; connect-src 'self' http://localhost:5232 ws://localhost:5173 ws://127.0.0.1:5173; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";

    public static string JwtScope(IConfiguration config, string field, bool development)
    {
        var value = config["Jwt:" + field];
        if (value == null && development) return field == "Issuer" ? DevelopmentIssuer : DevelopmentAudience;
        if (string.IsNullOrWhiteSpace(value) || value.Length > 256 || value != value.Trim() ||
            !Uri.TryCreate(value, UriKind.Absolute, out _) ||
            (!development && (value.Equals(DevelopmentIssuer, StringComparison.OrdinalIgnoreCase) || value.Equals(DevelopmentAudience, StringComparison.OrdinalIgnoreCase))) ||
            new[] { "example", "default", "changeme", "placeholder" }.Any(s=>value.Contains(s,StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"Jwt:{field} must be an explicit, non-example absolute URI/URN identifier.");
        return value;
    }

    public static void AddHeaders(HttpContext context, bool development)
    {
        var headers=context.Response.Headers;
        // Protected image routes retain a strict sandbox policy, including denied responses.
        if(context.Request.Path.StartsWithSegments("/uploads") || context.Request.Path.StartsWithSegments("/api/ProfileImages"))
            headers["Content-Security-Policy"]="default-src 'none'; sandbox";
        if (!headers.ContainsKey("Content-Security-Policy")) headers["Content-Security-Policy"]=development?DevelopmentCsp:ProductionCsp;
        headers["X-Frame-Options"]="DENY";
        headers["X-Content-Type-Options"]="nosniff";
        headers["Referrer-Policy"]="no-referrer";
        headers["Permissions-Policy"]="camera=(), microphone=(), geolocation=(), payment=(), usb=()";
        if(context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/uploads")) headers.CacheControl="no-store";
    }

    public static async Task UnexpectedError(HttpContext context)
    {
        var error=context.Features.Get<IExceptionHandlerFeature>()?.Error;
        // Exception messages can contain secrets/SQL/request input. Log only type + server trace ID.
        context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("SafeErrors")
            .LogError("Unhandled {ExceptionType}; trace {TraceId}",error?.GetType().FullName,context.TraceIdentifier);
        context.Response.StatusCode=500;
        context.Response.Headers.CacheControl="no-store";
        await Results.Problem(statusCode:500,title:"An unexpected error occurred.",extensions:new Dictionary<string,object?> { ["traceId"]=context.TraceIdentifier }).ExecuteAsync(context);
    }
}

// Runs after the built-in controller feature provider. Environment is fixed by the host, never by a request.
public sealed class NonDevelopmentControllers : IApplicationFeatureProvider<ControllerFeature>
{
    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
    {
        var seed=typeof(CarServiceShop.Controllers.SeedController).GetTypeInfo();
        feature.Controllers.Remove(seed);
    }
}
