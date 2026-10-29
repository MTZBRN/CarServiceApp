FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble AS build
WORKDIR /app

# A mappaszerkezeted alapján: CarServiceShop/CarServiceShop.csproj
COPY CarServiceShop/*.csproj ./CarServiceShop/
RUN dotnet restore CarServiceShop/CarServiceShop.csproj

COPY CarServiceShop/ ./CarServiceShop/
RUN dotnet publish CarServiceShop/CarServiceShop.csproj -c Release --no-restore -o out

FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble
WORKDIR /app
COPY --from=build /app/out .
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ConnectionStrings__DefaultConnection="Data Source=/app/data/app.db" \
    Uploads__Path=/app/uploads \
    HOME=/tmp
RUN mkdir -p /app/data /app/uploads \
    && chown 1654:1654 /app/data /app/uploads \
    && chmod 0700 /app/data /app/uploads \
    && chmod -R go-w /app
VOLUME ["/app/data", "/app/uploads"]
USER 1654:1654
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["dotnet", "CarServiceShop.dll", "--healthcheck"]
ENTRYPOINT ["dotnet", "CarServiceShop.dll"]
