# Прод-образ Mini App: збирає React-фронтенд і віддає його через nginx.
# Контекст збірки — корінь проєкту (щоб дістати і frontend/, і nginx/):
#     docker build -f nginx/Dockerfile .
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

# --- Стадія 2: віддача статики ---
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://localhost/index.html > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
