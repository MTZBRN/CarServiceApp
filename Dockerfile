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
# ✅ GOLYÓÁLLÓ MEGOLDÁS: Átmásoljuk a teljes Backend mappát egyben
COPY Backend/ ./Backend/
WORKDIR /src/Backend
# Így biztosan megtalálja a csproj fájlt, akár egy almappában van, akár a gyökérben
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# ⚠️ NAGYON FONTOS: Írd át a CarServiceApp.dll-t a saját C# projekted nevére!
# (Amilyen néven a .csproj fájlod van, általában az a .dll neve is)
ENTRYPOINT ["dotnet", "CarServiceApp.dll"]