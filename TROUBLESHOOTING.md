## Решение проблем при развертывании

### Ошибка: password authentication failed for user "afrodita_user"

**Причина:**
- PostgreSQL volume уже существует с другими учетными данными
- Несоответствие паролей в .env файле
- Пользователь не создан в базе данных

**Решение 1: Пересоздание базы данных (если данных нет)**

```bash
# Остановить все контейнеры и удалить volumes
docker compose down -v

# Или если используете docker-compose
docker-compose down -v

# Удалить volume PostgreSQL вручную (если нужно)
docker volume rm afrodita_postgres_data

# Запустить скрипт развертывания заново
./deploy.sh
```

**Решение 2: Проверка и исправление .env файла**

Убедитесь, что в `.env` файле совпадают значения:

```env
POSTGRES_USER=afrodita_user
POSTGRES_PASSWORD=ваш_пароль
DB_USER=afrodita_user
DB_PASSWORD=ваш_пароль
```

**Решение 3: Создание пользователя вручную**

Если база данных уже существует с другими учетными данными:

```bash
# Подключиться к PostgreSQL контейнеру
docker compose exec postgres psql -U postgres

# В консоли PostgreSQL выполнить:
CREATE USER afrodita_user WITH PASSWORD 'ваш_пароль';
ALTER USER afrodita_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE afrodita TO afrodita_user;

# Выйти
\q
```

**Решение 4: Проверка переменных окружения в контейнере**

```bash
# Проверить переменные в backend контейнере
docker compose exec backend env | grep DB_

# Проверить переменные в postgres контейнере
docker compose exec postgres env | grep POSTGRES_
```

**Решение 5: Использование существующей базы данных**

Если у вас уже есть база данных с другими учетными данными, обновите `.env`:

```env
# Используйте существующие учетные данные
POSTGRES_USER=существующий_пользователь
POSTGRES_PASSWORD=существующий_пароль
DB_USER=существующий_пользователь
DB_PASSWORD=существующий_пароль
```

Затем перезапустите контейнеры:

```bash
docker compose down
docker compose up -d
```

### Ошибка: Cannot connect to database

**Причина:**
- PostgreSQL контейнер не запущен
- Неправильный DB_HOST в .env

**Решение:**

```bash
# Проверить статус контейнеров
docker compose ps

# Проверить логи PostgreSQL
docker compose logs postgres

# Убедиться, что DB_HOST=postgres в .env
```

### Ошибка: relation "appointments" does not exist

**Причина:**
- Миграции не были выполнены
- База данных пустая
- Backend запустился до выполнения миграций

**Решение 1: Выполнить миграции вручную**

```bash
# Проверить подключение к базе данных
docker compose exec backend env | grep DB_

# Выполнить миграции
docker compose exec backend npm run migration:run

# Проверить созданные таблицы
docker compose exec postgres psql -U afrodita_user -d afrodita -c "\dt"
```

**Решение 2: Если миграции не выполняются через npm**

```bash
# Выполнить миграции через node напрямую
docker compose exec backend sh -c "cd /app && node -r ts-node/register node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js"

# Или через скомпилированный код
docker compose exec backend sh -c "cd /app && node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js"
```

**Решение 3: Проверка существования миграций**

```bash
# Проверить наличие файлов миграций
docker compose exec backend ls -la /app/src/migrations/

# Проверить логи миграций
docker compose exec backend npm run migration:run
```

**Решение 4: Пересоздание базы данных с миграциями**

```bash
# Остановить контейнеры
docker compose down

# Удалить volume PostgreSQL
docker volume rm afrodita_postgres_data

# Запустить контейнеры заново
docker compose up -d

# Дождаться готовности PostgreSQL
sleep 10

# Выполнить миграции
docker compose exec backend npm run migration:run
```

### Ошибка: Migration failed

**Причина:**
- База данных не создана
- Пользователь не имеет прав
- Неправильный путь к миграциям

**Решение:**

```bash
# Создать базу данных вручную
docker compose exec postgres psql -U afrodita_user -c "CREATE DATABASE afrodita;"

# Проверить права пользователя
docker compose exec postgres psql -U postgres -c "\du"

# Выполнить миграции
docker compose exec backend npm run migration:run

# Проверить результат
docker compose exec postgres psql -U afrodita_user -d afrodita -c "\dt"
```

### Ошибка: Port already in use

**Причина:**
- Порт уже занят другим процессом

**Решение:**

```bash
# Найти процесс, использующий порт
sudo lsof -i :80
sudo lsof -i :443

# Остановить процесс или изменить порты в docker-compose.yml
```

### Ошибка: SSL certificate generation failed

**Причина:**
- OpenSSL не установлен в nginx контейнере
- Нет прав на запись в директорию

**Решение:**

```bash
# Проверить логи nginx
docker compose logs nginx

# Пересоздать nginx контейнер
docker compose up -d --force-recreate nginx
```

### Проверка работоспособности

```bash
# Проверить статус всех контейнеров
docker compose ps

# Проверить логи всех сервисов
docker compose logs

# Проверить подключение к базе данных
docker compose exec backend npm run migration:run

# Проверить health checks
curl -k https://ваш_ip/health
curl -k https://ваш_ip/api/v1/health
```

### Полный сброс (удаление всех данных)

**ВНИМАНИЕ: Это удалит все данные!**

```bash
# Остановить и удалить все контейнеры и volumes
docker compose down -v

# Удалить все volumes вручную
docker volume ls | grep afrodita
docker volume rm afrodita_postgres_data afrodita_redis_data

# Удалить все образы (опционально)
docker compose down --rmi all

# Запустить развертывание заново
./deploy.sh
```

