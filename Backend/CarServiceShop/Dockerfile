FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble AS build
WORKDIR /app

# A mappaszerkezeted alapján: CarServiceShop/CarServiceShop.csproj
COPY CarServiceShop/*.csproj ./CarServiceShop/
RUN dotnet restore CarServiceShop/CarServiceShop.csproj

COPY . ./
RUN dotnet publish CarServiceShop/CarServiceShop.csproj -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble
WORKDIR /app
COPY --from=build /app/out .
ENTRYPOINT ["dotnet", "CarServiceShop.dll"]
