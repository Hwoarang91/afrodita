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

# Компилируем миграции TypeScript в JavaScript
# TypeScript компилятор должен компилировать их автоматически, но на всякий случай компилируем явно
RUN if [ -d "src/migrations" ] && [ -n "$(ls -A src/migrations/*.ts 2>/dev/null)" ]; then \
      echo "Компиляция миграций TypeScript в JavaScript..."; \
      mkdir -p dist/migrations && \
      for file in src/migrations/*.ts; do \
        filename=$(basename "$file" .ts); \
        npx tsc "$file" --outDir dist/migrations --module commonjs --target ES2021 --esModuleInterop --skipLibCheck --declaration false --sourceMap false --rootDir src --resolveJsonModule false 2>&1 | head -3 || \
        (echo "Компиляция $filename через альтернативный метод..." && \
         node -e "const fs=require('fs'),path=require('path');const src=fs.readFileSync('$file','utf8');const js=src.replace(/import\s+(\{[^}]*\}|\w+)\s+from\s+['\"]([^'\"]+)['\"]/g,'const $1=require(\"$2\")').replace(/export\s+(class|interface|const|let|var|function)/g,'$1').replace(/export\s+default/g,'module.exports=');fs.writeFileSync(path.join('dist/migrations','$filename.js'),js);" 2>/dev/null || true); \
      done; \
      echo "Проверка скомпилированных миграций:"; \
      ls -la dist/migrations/*.js 2>/dev/null | head -5 || echo "⚠️ Миграции не скомпилированы"; \
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
COPY package*.json ./
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

# Копируем bcrypt из builder stage (уже скомпилирован)
# Это необходимо, так как bcrypt требует компиляции нативных модулей
# Внутри bcrypt уже есть все необходимые зависимости
RUN mkdir -p node_modules
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

