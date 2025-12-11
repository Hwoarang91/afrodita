FROM node:20-alpine as builder

# Создаем структуру проекта как в монорепо
WORKDIR /workspace

# Копируем shared папку
COPY shared ./shared

# Проверяем, что shared скопировался
RUN ls -la ./shared/ && ls -la ./shared/types/ || echo "Shared not found"

# Копируем apps/telegram (исключая node_modules и dist)
COPY apps/telegram ./apps/telegram

# Проверяем структуру workspace
RUN ls -la /workspace/ && echo "---" && ls -la /workspace/shared/ 2>&1 || echo "Shared not in workspace"

# Переходим в директорию приложения
WORKDIR /workspace/apps/telegram

# Создаем симлинк для shared (если нужно)
RUN ln -sf /workspace/shared ../shared || echo "Symlink creation skipped"

# Проверяем структуру из apps/telegram
RUN ls -la ../shared/types/ 2>&1 || echo "Shared types not found"

# Устанавливаем зависимости
RUN npm ci --include=dev

# Собираем проект
RUN npm run build

FROM nginx:alpine

# Удаляем дефолтную конфигурацию nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Копируем собранные файлы и конфигурацию
COPY --from=builder /workspace/apps/telegram/dist /usr/share/nginx/html
COPY apps/telegram/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

