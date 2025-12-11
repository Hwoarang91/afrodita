FROM node:18-alpine AS builder

# Установка tzdata и build tools для компиляции нативных модулей (bcrypt)
RUN apk add --no-cache tzdata python3 make g++

# Настройка кодировки для правильного отображения русского языка
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

# Копируем package файлы и устанавливаем все зависимости (включая devDependencies для сборки)
COPY backend/package*.json ./
RUN npm ci --include=dev

# Копируем shared папку (нужна для компиляции TypeScript с @shared/* путями)
COPY shared ./shared

# Копируем исходный код
COPY backend/ .

# Создаем симлинк для shared в src (для TypeScript rootDir и paths)
RUN mkdir -p src && ln -sf /app/shared src/shared

# Собираем проект
RUN npm run build

# Компилируем миграции TypeScript в JavaScript явно
# NestJS не компилирует миграции автоматически, поэтому компилируем их отдельно
RUN if [ -d "src/migrations" ] && [ -n "$(ls -A src/migrations/*.ts 2>/dev/null)" ]; then \
      echo "Компиляция миграций TypeScript в JavaScript..."; \
      mkdir -p dist/migrations && \
      npx tsc src/migrations/*.ts --outDir dist/migrations --module commonjs --target ES2021 \
        --esModuleInterop --skipLibCheck --declaration false --sourceMap false \
        --rootDir src --resolveJsonModule false --moduleResolution node 2>&1 || \
      (echo "Попытка компиляции по одному файлу..." && \
       for file in src/migrations/*.ts; do \
         filename=$(basename "$file" .ts); \
         echo "Компиляция $filename..."; \
         npx tsc "$file" --outDir dist/migrations --module commonjs --target ES2021 \
           --esModuleInterop --skipLibCheck --declaration false --sourceMap false \
           --rootDir src --moduleResolution node 2>&1 | grep -v "error TS" || true; \
       done); \
      echo "Проверка скомпилированных миграций:"; \
      if [ -n "$(ls -A dist/migrations/*.js 2>/dev/null)" ]; then \
        echo "✅ Найдено .js файлов: $(ls -1 dist/migrations/*.js 2>/dev/null | wc -l)"; \
        ls -la dist/migrations/*.js | head -3; \
      else \
        echo "❌ Миграции не скомпилированы в .js файлы"; \
        echo "Содержимое dist/migrations:"; \
        ls -la dist/migrations/ 2>/dev/null || echo "Директория не существует"; \
      fi; \
    fi

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
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Копируем собранные файлы из builder stage (включая скомпилированные миграции)
COPY --from=builder /app/dist ./dist

# Проверяем наличие скомпилированных миграций (.js файлы)
RUN if [ -d "dist/migrations" ] && [ -n "$(ls -A dist/migrations/*.js 2>/dev/null)" ]; then \
      echo "✅ Скомпилированные миграции найдены:"; \
      ls -la dist/migrations/*.js | head -5; \
      echo "Всего .js файлов: $(ls -1 dist/migrations/*.js 2>/dev/null | wc -l)"; \
    else \
      echo "❌ Внимание: скомпилированные миграции (.js) не найдены в dist/migrations/"; \
      echo "Содержимое dist/migrations:"; \
      ls -la dist/migrations/ 2>/dev/null || echo "Директория не существует"; \
    fi

# Устанавливаем bcrypt в production stage
# bcrypt требует компиляции нативных модулей, поэтому устанавливаем его отдельно
RUN apk add --no-cache python3 make g++ && \
    npm install bcrypt && \
    apk del python3 make g++

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

