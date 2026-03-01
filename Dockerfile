# 1. Fázis: A React (Frontend) lefordítása
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY Frontend/package*.json ./
RUN npm install
COPY Frontend/ ./
RUN npm run build

# 2. Fázis: A C# (Backend) lefordítása
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src

# Átmásoljuk az egész Backend mappát
COPY Backend/ ./Backend/

# ✅ GOLYÓÁLLÓ MEGOLDÁS: A Docker automatikusan megkeresi a .csproj fájlt és lefordítja!
RUN PROJECT_FILE=$(find Backend -name "*.csproj" | head -n 1) && \
    echo "Megtalalt projekt fajl: $PROJECT_FILE" && \
    dotnet publish "$PROJECT_FILE" -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Futtatás
ENTRYPOINT ["dotnet", "CarServiceShop.dll"]