FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

# Установка wget для health checks
RUN apk add --no-cache wget

WORKDIR /app

# Копируем package файлы и устанавливаем только production зависимости
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем собранные файлы из builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js* ./
COPY --from=builder /app/next.config.mjs* ./
COPY --from=builder /app/package.json ./package.json

EXPOSE 3002

CMD ["npm", "start"]

