# Multi-stage build для оптимизации
FROM node:20-alpine AS base

# Установка зависимостей
FROM base AS deps
WORKDIR /app
COPY landing/package*.json ./
RUN npm ci

# Development stage
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY landing/ ./
EXPOSE 8090
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8090"]

# Production build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY landing/package*.json ./
COPY landing/index.html ./
COPY landing/vite.config.ts ./
COPY landing/tsconfig*.json ./
COPY landing/postcss.config.js ./
COPY landing/tailwind.config.ts ./
COPY landing/components.json ./
COPY landing/eslint.config.js ./
COPY landing/public ./public
COPY landing/src ./src
RUN npm run build

# Production stage
FROM nginx:alpine AS production
ENV NODE_ENV=production

# Копируем собранные файлы
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию Nginx
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf

# Добавляем healthcheck endpoint
RUN echo 'location /health { return 200 "ok"; add_header Content-Type text/plain; }' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

