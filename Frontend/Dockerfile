# 1. fázis: Buildelés (Node.js 22-re váltva a Vite miatt!)
FROM node:22-alpine as build

WORKDIR /app

# Függőségek másolása és telepítése
COPY package.json package-lock.json ./
RUN npm install

# Forráskód másolása és buildelés
COPY . .
RUN npm run build

# 2. fázis: Futtatás (Nginx szerver)
FROM nginx:alpine

# Másoljuk a buildelt fájlokat az Nginx-be
COPY --from=build /app/dist /usr/share/nginx/html

# Másoljuk be a saját nginx konfigurációnkat
COPY nginx.conf /etc/nginx/conf.d/default.conf

# A 80-as porton figyelünk
EXPOSE 80

# Nginx indítása
CMD ["nginx", "-g", "daemon off;"]