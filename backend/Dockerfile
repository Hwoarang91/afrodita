FROM node:18-alpine

# Установка tzdata для правильной работы с таймзоной
RUN apk add --no-cache tzdata

# Настройка кодировки для правильного отображения русского языка
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start:prod"]

