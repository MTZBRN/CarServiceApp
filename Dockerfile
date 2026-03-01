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

# Átmásoljuk az egész Backend mappát a gyökérből
COPY Backend/ ./Backend/

# ✅ ITT A PONTOS ÚTVONAL A KÉPED ALAPJÁN:
RUN dotnet publish "Backend/CarServiceShop/CarServiceShop.csproj" -c Release -o /app/publish

# 3. Fázis: Összeolvasztás és Futtatás
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Futtatás
ENTRYPOINT ["dotnet", "CarServiceShop.dll"]