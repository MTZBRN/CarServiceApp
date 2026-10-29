using System.Net;
using CarServiceShop.Security;

namespace CarServiceShop.Tests;

public class Stage3CHygieneTests
{
    [Fact]
    public async Task HealthEndpointIsAnonymousFixedAndNotCached()
    {
        using var host = new SecurityHost();
        using var client = host.Client();
        var response = await client.GetAsync("/healthz");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("healthy", await response.Content.ReadAsStringAsync());
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Theory]
    [InlineData(200, 0)]
    [InlineData(204, 1)]
    [InlineData(302, 1)]
    [InlineData(401, 1)]
    [InlineData(500, 1)]
    public async Task ProbeRequiresSuccessfulApplicationResponse(int status, int expected)
    {
        var handler = new ProbeHandler(request => {
            Assert.Equal("http://127.0.0.1:8080/healthz", request.RequestUri!.AbsoluteUri);
            Assert.Null(request.Headers.Authorization);
            return Task.FromResult(new HttpResponseMessage((HttpStatusCode)status));
        });
        Assert.Equal(expected, await ContainerHealthProbe.RunAsync(handler));
    }

    [Fact]
    public async Task ProbeTreatsConnectionFailureAndTimeoutAsUnhealthy()
    {
        Assert.Equal(1, await ContainerHealthProbe.RunAsync(new ProbeHandler(_ => Task.FromException<HttpResponseMessage>(new HttpRequestException()))));
        Assert.Equal(1, await ContainerHealthProbe.RunAsync(new ProbeHandler(_ => Task.FromException<HttpResponseMessage>(new TaskCanceledException()))));
    }

    private sealed class ProbeHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
