# 1. Build szakasz
FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2. Szerver szakasz (Nginx fogja kiszolgálni a statikus fájlokat)
FROM nginx:1.30.6-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY proxy-headers.conf /etc/nginx/proxy-headers.conf
RUN touch /etc/nginx/trusted-edge.conf
# No root entrypoint setup: configuration and static content are complete at build time.
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
