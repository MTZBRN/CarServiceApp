using Microsoft.AspNetCore.Http.Features;

namespace CarServiceShop.Security;

public static class RequestBounds
{
    public const int JsonBytes = 1024 * 1024;
    public static async Task Apply(HttpContext context, RequestDelegate next)
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            var upload = HttpMethods.IsPost(context.Request.Method) && context.Request.Path.Equals("/api/Auth/upload-profile-picture", StringComparison.OrdinalIgnoreCase);
            var login = context.Request.Path.Equals("/api/Auth/login", StringComparison.OrdinalIgnoreCase);
            var maximum = upload ? ProfileImages.MaxBytes + 65536 : login ? 4096 : JsonBytes;
            if (context.Request.ContentLength > maximum) {
                await Results.Problem(statusCode:413,title:"Request body too large.").ExecuteAsync(context); return;
            }
            var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (feature is { IsReadOnly:false }) feature.MaxRequestBodySize=maximum;
            // Counting stream also covers chunked/unknown-length bodies and hosts without a Kestrel feature.
            context.Request.Body = new BoundedBody(context.Request.Body, maximum);
        }
        try { await next(context); }
        catch (BadHttpRequestException error) when (error.StatusCode==413 && !context.Response.HasStarted) {
            context.Response.Clear(); await Results.Problem(statusCode:413,title:"Request body too large.").ExecuteAsync(context);
        }
    }
    private sealed class BoundedBody(Stream inner, long limit) : Stream
    {
        private long read;
        private void Count(int count) { read+=count; if(read>limit) throw new BadHttpRequestException("Request body too large.",413); }
        public override int Read(byte[] buffer,int offset,int count) { var result=inner.Read(buffer,offset,count);Count(result);return result; }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer,CancellationToken cancellationToken=default) {var result=await inner.ReadAsync(buffer,cancellationToken);Count(result);return result;}
        public override async Task<int> ReadAsync(byte[] buffer,int offset,int count,CancellationToken cancellationToken) {var result=await inner.ReadAsync(buffer.AsMemory(offset,count),cancellationToken);Count(result);return result;}
        public override bool CanRead=>true;public override bool CanSeek=>false;public override bool CanWrite=>false;
        public override long Length=>throw new NotSupportedException();public override long Position{get=>read;set=>throw new NotSupportedException();}
        public override void Flush()=>throw new NotSupportedException();public override long Seek(long offset,SeekOrigin origin)=>throw new NotSupportedException();
        public override void SetLength(long value)=>throw new NotSupportedException();public override void Write(byte[] buffer,int offset,int count)=>throw new NotSupportedException();
    }
}
