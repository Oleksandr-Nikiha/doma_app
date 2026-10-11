# Прод-образ Mini App: збирає React-фронтенд і віддає його через Caddy.
# Контекст збірки — корінь проєкту (щоб дістати і frontend/, і caddy/):
#     docker build -f caddy/Dockerfile .
#
# УВАГА: стадія build запрацює лише після того, як з'явиться frontend/package.json.

# --- Стадія 1: збірка фронтенду ---
FROM node:20-alpine AS build

WORKDIR /app

# Спершу тільки маніфести — шар з npm ci кешується, поки залежності не змінились
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./

# Vite вшиває VITE_*-змінні у бандл на етапі збірки, а не в рантаймі,
# тож базовий URL API передається як build-arg.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# --- Стадія 2: віддача статики та проксі ---
FROM caddy:2-alpine

COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://localhost/index.html > /dev/null || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

