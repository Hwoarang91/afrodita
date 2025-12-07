# Инструкции по запуску в продакшене

## Подготовка

1. Скопируйте `.env.example` в `.env` и заполните все переменные окружения:
```bash
cp .env.example .env
```

2. Обязательно измените следующие секретные значения:
   - `POSTGRES_PASSWORD` - надежный пароль для PostgreSQL
   - `JWT_SECRET` - случайная строка минимум 32 символа
   - `JWT_REFRESH_SECRET` - случайная строка минимум 32 символа
   - `TELEGRAM_BOT_TOKEN` - токен вашего Telegram бота
   - `TELEGRAM_WEBHOOK_SECRET` - секретный ключ для webhook

3. Настройте URL'ы для вашего домена:
   - `FRONTEND_URL` - URL фронтенда
   - `ADMIN_URL` - URL админ-панели
   - `VITE_API_URL` - URL API для фронтенда
   - `NEXT_PUBLIC_API_URL` - URL API для админ-панели
   - `TELEGRAM_WEBHOOK_URL` - URL для Telegram webhook

## Сборка и запуск

### Сборка образов без кеша
```bash
docker compose -f docker-compose.yml build --no-cache
```

### Запуск контейнеров
```bash
docker compose -f docker-compose.yml up -d
```

### Проверка статуса
```bash
docker compose -f docker-compose.yml ps
```

### Просмотр логов
```bash
docker compose -f docker-compose.yml logs -f
```

### Остановка
```bash
docker compose -f docker-compose.yml down
```

## Health Checks

Все сервисы имеют health checks:
- Backend: `http://localhost:3001/health`
- Frontend: `http://localhost:3000/health`
- Admin: `http://localhost:3002/`

## Безопасность

1. **Никогда не коммитьте `.env` файл в git**
2. Используйте сильные пароли для базы данных
3. Настройте SSL/TLS для production
4. Ограничьте доступ к портам базы данных и Redis
5. Используйте reverse proxy (nginx/traefik) перед приложением
6. Настройте firewall правила
7. Регулярно обновляйте зависимости

## Мониторинг

- Проверяйте логи регулярно: `docker compose logs -f`
- Мониторьте использование ресурсов: `docker stats`
- Настройте алерты на health check failures

## Обновление

1. Остановите контейнеры: `docker compose down`
2. Обновите код: `git pull`
3. Пересоберите образы: `docker compose build --no-cache`
4. Запустите: `docker compose up -d`
5. Проверьте логи: `docker compose logs -f`

## Резервное копирование

Регулярно делайте бэкапы базы данных:
```bash
docker exec afrodita-postgres pg_dump -U postgres afrodita > backup_$(date +%Y%m%d_%H%M%S).sql
```

