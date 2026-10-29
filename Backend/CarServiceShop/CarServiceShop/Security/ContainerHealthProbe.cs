using System.Net;

namespace CarServiceShop.Security;

public static class ContainerHealthProbe
{
    public static async Task<int> RunAsync(HttpMessageHandler? handler = null)
    {
        using var client = new HttpClient(handler ?? new SocketsHttpHandler {
            AllowAutoRedirect = false,
            UseProxy = false
        }) { Timeout = TimeSpan.FromSeconds(3) };
        try
        {
            using var response = await client.GetAsync("http://127.0.0.1:8080/healthz", HttpCompletionOption.ResponseHeadersRead);
            return response.StatusCode == HttpStatusCode.OK ? 0 : 1;
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException)
        {
            return 1;
        }
    }
}
