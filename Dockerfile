# 1. Fázis: A React (Frontend) lefordítása
FROM node:18 AS frontend-build
WORKDIR /app/frontend
# Másoljuk a package.json fájlokat és telepítjük a csomagokat
COPY Frontend/package*.json ./
RUN npm install
# Másoljuk a teljes frontend kódot és lefordítjuk
COPY Frontend/ ./
RUN npm run build

# 2. Fázis: A C# (Backend) lefordítása
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /app/backend
# Másoljuk a csproj fájlt és letöltjük a csomagokat
COPY Backend/*.csproj ./
RUN dotnet restore
# Másoljuk a teljes backend kódot és publikáljuk
COPY Backend/ ./
RUN dotnet publish -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
# Átmásoljuk a lefordított C# programot
COPY --from=backend-build /app/publish .
# Átmásoljuk a lefordított React programot a C# wwwroot mappájába!
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# FONTOS: Cseréld ki a "Backend.dll"-t a te C# projekted nevére! 
# (Pl. ha CarServiceApi a csproj neve, akkor CarServiceApi.dll)
ENTRYPOINT ["dotnet", "Backend.dll"]