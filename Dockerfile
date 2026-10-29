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

# Átmásoljuk az egész Backend mappát
COPY Backend/ ./Backend/

# A Docker automatikusan megkeresi a .csproj fájlt és lefordítja
RUN PROJECT_FILE=$(find Backend -name "*.csproj" | head -n 1) && \
    echo "Megtalalt projekt fajl: $PROJECT_FILE" && \
    dotnet publish "$PROJECT_FILE" -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás (.NET 10 LTS)
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Futtatás
ENTRYPOINT ["dotnet", "CarServiceShop.dll"]
