FROM node:18-alpine AS builder

# Установка tzdata и build tools для компиляции нативных модулей (bcrypt)
RUN apk add --no-cache tzdata python3 make g++

# Настройка кодировки для правильного отображения русского языка
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

# Копируем package файлы и устанавливаем все зависимости (включая devDependencies для сборки)
COPY package*.json ./
RUN npm ci --include=dev

# Копируем исходный код и собираем проект
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

# Установка tzdata и wget для health checks
RUN apk add --no-cache tzdata wget

# Настройка кодировки для правильного отображения русского языка
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV NODE_ENV=production

WORKDIR /app

# Копируем package файлы и устанавливаем только production зависимости
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем собранные файлы из builder stage
COPY --from=builder /app/dist ./dist

# Явно копируем миграции, если они не были скопированы автоматически
COPY --from=builder /app/src/migrations ./dist/migrations 2>/dev/null || true

# Проверяем наличие миграций
RUN if [ -d "dist/migrations" ]; then \
      echo "✅ Миграции найдены:"; \
      ls -la dist/migrations/; \
    else \
      echo "❌ Внимание: миграции не найдены в dist/migrations/"; \
    fi

# Копируем bcrypt из builder stage (уже скомпилирован)
# Это необходимо, так как bcrypt требует компиляции нативных модулей
# Внутри bcrypt уже есть все необходимые зависимости
RUN mkdir -p node_modules
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

