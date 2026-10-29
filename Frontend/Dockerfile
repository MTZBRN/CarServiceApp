# 1. Build szakasz
FROM node:20 AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. Szerver szakasz (Nginx fogja kiszolgálni a statikus fájlokat)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
# Ha React Router-t használsz, egy alap Nginx config kellhet ide (opcionális)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
