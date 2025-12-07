FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM nginx:alpine

# Удаляем дефолтную конфигурацию nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Копируем собранные файлы и конфигурацию
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

