# 1. Fázis: A React (Frontend) lefordítása
FROM node:24.22.2-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

# 2. Fázis: A C# (Backend) lefordítása (.NET 10 LTS)
FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble AS backend-build
WORKDIR /src

COPY Backend/CarServiceShop/CarServiceShop/ ./Backend/CarServiceShop/CarServiceShop/
RUN dotnet publish Backend/CarServiceShop/CarServiceShop/CarServiceShop.csproj -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás (.NET 10 LTS)
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot
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
