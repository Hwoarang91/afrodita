#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ВНИМАНИЕ]${NC} $1"
}

print_error() {
    echo -e "${RED}[ОШИБКА]${NC} $1"
}

# Функция для проверки команды
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 не установлен"
        return 1
    fi
    return 0
}

# Функция для генерации случайной строки
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Функция для валидации IP адреса
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Заголовок
clear
echo "=========================================="
echo "  Скрипт автоматического развертывания"
echo "  Афродита - Массажный салон"
echo "=========================================="
echo ""

# Проверка прав root/sudo
if [ "$EUID" -ne 0 ]; then 
    print_warning "Скрипт требует прав sudo. Запрос пароля..."
    sudo -v
    if [ $? -ne 0 ]; then
        print_error "Не удалось получить права sudo"
        exit 1
    fi
fi

# Шаг 1: Проверка зависимостей
print_info "Шаг 1: Проверка зависимостей..."

if ! check_command docker; then
    print_error "Docker не установлен. Установите Docker:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sh get-docker.sh"
    exit 1
fi
print_success "Docker установлен"

# Проверка Docker Compose (плагин или standalone)
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    print_success "Docker Compose plugin установлен"
elif docker-compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    print_success "Docker Compose standalone установлен"
else
    print_error "Docker Compose не установлен"
    print_info "Установите Docker Compose plugin:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install docker-compose-plugin"
    exit 1
fi

if ! check_command openssl; then
    print_warning "OpenSSL не установлен. Устанавливаю..."
    sudo apt-get update -qq
    sudo apt-get install -y openssl
    print_success "OpenSSL установлен"
else
    print_success "OpenSSL установлен"
fi

# Шаг 2: Настройка firewall
print_info "Шаг 2: Настройка firewall..."

if command -v ufw &> /dev/null; then
    print_info "Настройка UFW..."
    
    # Проверка статуса UFW
    if sudo ufw status | grep -q "Status: active"; then
        print_info "UFW уже активен"
    else
        print_info "Включение UFW..."
        echo "y" | sudo ufw enable
    fi
    
    # Открытие портов
    print_info "Открытие портов 22, 80, 443..."
    sudo ufw allow 22/tcp comment 'SSH'
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    
    print_success "Firewall настроен"
elif command -v firewall-cmd &> /dev/null; then
    print_info "Настройка firewalld..."
    sudo firewall-cmd --permanent --add-port=22/tcp
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --reload
    print_success "Firewall настроен"
else
    print_warning "Firewall не найден. Убедитесь, что порты 80 и 443 открыты вручную"
fi

# Шаг 3: Получение данных от пользователя
print_info "Шаг 3: Сбор информации для настройки..."

# IP адрес сервера
read -p "Введите IP адрес сервера [194.87.54.64]: " SERVER_IP
SERVER_IP=${SERVER_IP:-194.87.54.64}

if ! validate_ip "$SERVER_IP"; then
    print_error "Неверный формат IP адреса"
    exit 1
fi
print_success "IP адрес: $SERVER_IP"

# Пароль для PostgreSQL
while true; do
    read -sp "Введите пароль для PostgreSQL (минимум 8 символов): " POSTGRES_PASSWORD
    echo ""
    if [ ${#POSTGRES_PASSWORD} -ge 8 ]; then
        break
    else
        print_error "Пароль должен содержать минимум 8 символов"
    fi
done
print_success "Пароль для PostgreSQL установлен"

# Токен Telegram бота (опционально)
read -p "Введите токен Telegram бота (или нажмите Enter, чтобы пропустить): " TELEGRAM_BOT_TOKEN
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
    print_warning "Токен Telegram бота не указан. Вы сможете добавить его позже в .env"
else
    print_success "Токен Telegram бота установлен"
fi

# Шаг 4: Генерация секретов
print_info "Шаг 4: Генерация секретных ключей..."

JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)

print_success "JWT секреты сгенерированы"

# Шаг 5: Создание .env файла
print_info "Шаг 5: Создание .env файла..."

cat > .env << EOF
# База данных PostgreSQL
POSTGRES_USER=afrodita_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=afrodita
POSTGRES_PORT=5432
DB_HOST=postgres
DB_PORT=5432
DB_USER=afrodita_user
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_NAME=afrodita
DB_SSL=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT токены
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Telegram Bot
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_WEB_APP_URL=https://${SERVER_IP}

# URLs приложений
FRONTEND_URL=https://${SERVER_IP}
ADMIN_URL=https://${SERVER_IP}/admin
BACKEND_URL=https://${SERVER_IP}/api

# Порты для сервисов (используются только внутри Docker)
BACKEND_PORT=3001
FRONTEND_PORT=3000
ADMIN_PORT=3002

# IP адрес сервера для SSL сертификата
SERVER_IP=${SERVER_IP}

# Окружение
NODE_ENV=production

# Автоматическое выполнение миграций при старте
AUTO_RUN_MIGRATIONS=true

# Часовой пояс
TZ=Europe/Moscow
EOF

print_success ".env файл создан"

# Шаг 6: Проверка репозитория
print_info "Шаг 6: Проверка репозитория..."

if [ -d ".git" ]; then
    print_info "Обновление репозитория..."
    git pull
    if [ $? -eq 0 ]; then
        print_success "Реопозиторий обновлен"
    else
        print_warning "Не удалось обновить репозиторий. Продолжаем с текущей версией..."
    fi
else
    print_warning "Директория .git не найдена. Убедитесь, что вы находитесь в корне проекта."
    print_info "Если репозиторий еще не клонирован, выполните:"
    echo "  git clone https://github.com/Hwoarang91/afrodita.git"
    echo "  cd afrodita"
    echo "  ./deploy.sh"
fi

# Шаг 7: Сборка Docker образов
print_info "Шаг 7: Сборка Docker образов..."
print_warning "Это может занять несколько минут..."

$DOCKER_COMPOSE_CMD build --no-cache

if [ $? -ne 0 ]; then
    print_error "Ошибка при сборке Docker образов"
    exit 1
fi

print_success "Docker образы собраны"

# Шаг 8: Запуск контейнеров
print_info "Шаг 8: Запуск контейнеров..."

$DOCKER_COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
    print_error "Ошибка при запуске контейнеров"
    exit 1
fi

print_success "Контейнеры запущены"

# Шаг 9: Ожидание готовности сервисов
print_info "Шаг 9: Ожидание готовности сервисов..."
print_info "Ожидание 30 секунд для инициализации..."

sleep 30

# Проверка статуса контейнеров
print_info "Проверка статуса контейнеров..."
$DOCKER_COMPOSE_CMD ps

# Шаг 10: Проверка и настройка базы данных
print_info "Шаг 10: Проверка и настройка базы данных..."

# Ждем готовности базы данных
print_info "Ожидание готовности PostgreSQL..."
for i in {1..30}; do
    if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U ${POSTGRES_USER:-afrodita_user} > /dev/null 2>&1; then
        print_success "PostgreSQL готов"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL не готов после 30 попыток"
        exit 1
    fi
    sleep 2
done

# Проверка и создание пользователя и базы данных
print_info "Проверка пользователя и базы данных..."

# Ждем полной готовности PostgreSQL
print_info "Ожидание полной готовности PostgreSQL..."
sleep 5

# Попытка подключиться как суперпользователь postgres для создания/обновления пользователя
print_info "Попытка подключения как суперпользователь postgres..."
if $DOCKER_COMPOSE_CMD exec -T postgres psql -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Подключение как postgres успешно"
    print_info "Создание/обновление пользователя PostgreSQL..."
    
    # Создаем пользователя и базу данных через SQL скрипт
    $DOCKER_COMPOSE_CMD exec -T postgres psql -U postgres <<EOF
-- Создание пользователя (если не существует) или обновление пароля
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${POSTGRES_USER:-afrodita_user}') THEN
        CREATE USER ${POSTGRES_USER:-afrodita_user} WITH PASSWORD '${POSTGRES_PASSWORD}';
        ALTER USER ${POSTGRES_USER:-afrodita_user} CREATEDB;
        RAISE NOTICE 'Пользователь ${POSTGRES_USER:-afrodita_user} создан';
    ELSE
        ALTER USER ${POSTGRES_USER:-afrodita_user} WITH PASSWORD '${POSTGRES_PASSWORD}';
        RAISE NOTICE 'Пароль пользователя ${POSTGRES_USER:-afrodita_user} обновлен';
    END IF;
END
\$\$;

-- Создание базы данных (если не существует)
SELECT 'CREATE DATABASE ${POSTGRES_DB:-afrodita} OWNER ${POSTGRES_USER:-afrodita_user}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB:-afrodita}')\gexec

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB:-afrodita} TO ${POSTGRES_USER:-afrodita_user};
EOF

    # Подключаемся к базе данных и предоставляем права на схему
    $DOCKER_COMPOSE_CMD exec -T postgres psql -U postgres -d ${POSTGRES_DB:-afrodita} <<EOF
GRANT ALL ON SCHEMA public TO ${POSTGRES_USER:-afrodita_user};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${POSTGRES_USER:-afrodita_user};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${POSTGRES_USER:-afrodita_user};
EOF

    print_success "Пользователь и база данных настроены"
    
    # Проверяем подключение с новыми учетными данными
    print_info "Проверка подключения с новыми учетными данными..."
    if $DOCKER_COMPOSE_CMD exec -T postgres psql -U ${POSTGRES_USER:-afrodita_user} -d ${POSTGRES_DB:-afrodita} -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Подключение с новыми учетными данными успешно"
    else
        print_error "Не удалось подключиться с новыми учетными данными"
        print_info "Попробуйте запустить скрипт fix-postgres-auth.sh вручную"
    fi
else
    print_warning "Не удалось подключиться как postgres"
    print_info "Проверяем, может ли пользователь ${POSTGRES_USER:-afrodita_user} подключиться..."
    
    # Проверка существования базы данных
    if $DOCKER_COMPOSE_CMD exec -T postgres psql -U ${POSTGRES_USER:-afrodita_user} -d ${POSTGRES_DB:-afrodita} -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Подключение с пользователем ${POSTGRES_USER:-afrodita_user} успешно"
    else
        print_error "Не удалось подключиться к базе данных"
        print_warning "Возможно, нужно пересоздать volume PostgreSQL"
        print_info "Выполните следующие команды:"
        echo "  docker compose down"
        echo "  docker volume rm afrodita_postgres_data"
        echo "  docker compose up -d postgres"
        echo "  ./deploy.sh"
        exit 1
    fi
fi

# Выполнение миграций
print_info "Применение миграций..."

# Ждем, пока backend контейнер полностью соберется
print_info "Ожидание готовности backend контейнера..."
for i in {1..30}; do
    if $DOCKER_COMPOSE_CMD exec -T backend test -f /app/dist/main.js 2>/dev/null; then
        print_success "Backend контейнер готов"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend контейнер не готов после 30 попыток"
        exit 1
    fi
    sleep 2
done

# Выполнение миграций через TypeORM CLI
print_info "Запуск миграций базы данных..."

# Проверяем наличие миграций в контейнере
print_info "Проверка наличия миграций..."
if $DOCKER_COMPOSE_CMD exec -T backend test -d /app/dist/migrations 2>/dev/null; then
    MIGRATION_COUNT=$($DOCKER_COMPOSE_CMD exec -T backend sh -c "ls -1 /app/dist/migrations/*.js 2>/dev/null | wc -l" | tr -d ' ')
    if [ "$MIGRATION_COUNT" -gt "0" ]; then
        print_success "Найдено $MIGRATION_COUNT файлов миграций"
    else
        print_warning "Миграции не найдены в dist/migrations/"
    fi
else
    print_warning "Директория dist/migrations не найдена"
fi

# Пробуем выполнить миграции через TypeORM CLI
print_info "Выполнение миграций через TypeORM CLI..."

# Сначала пробуем через скомпилированный код (production)
MIGRATION_OUTPUT=$($DOCKER_COMPOSE_CMD exec -T backend sh -c "cd /app && node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js" 2>&1)
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    print_warning "Миграции через node не выполнены. Пробуем через ts-node..."
    # Альтернативный способ: через ts-node
    MIGRATION_OUTPUT=$($DOCKER_COMPOSE_CMD exec -T backend sh -c "cd /app && node -r ts-node/register node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js" 2>&1)
    MIGRATION_EXIT_CODE=$?
fi

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    print_success "Миграции успешно применены через CLI"
    echo "$MIGRATION_OUTPUT" | grep -E "(Migration|migration|executed|applied)" | tail -5 || echo "$MIGRATION_OUTPUT" | tail -5
else
    print_warning "Миграции не выполнены через CLI (код выхода: $MIGRATION_EXIT_CODE)"
    echo "$MIGRATION_OUTPUT" | tail -10
    print_info "Миграции будут выполнены автоматически при старте backend (AUTO_RUN_MIGRATIONS=true)"
    print_info "Проверьте логи backend после перезапуска:"
    echo "  $DOCKER_COMPOSE_CMD logs backend | grep -i migration"
fi

# Перезапускаем backend, чтобы миграции выполнились автоматически (если не выполнились через CLI)
if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    print_info "Перезапуск backend для автоматического выполнения миграций..."
    $DOCKER_COMPOSE_CMD restart backend
    print_info "Ожидание 15 секунд для выполнения миграций..."
    sleep 15
    
    # Проверяем логи на наличие сообщений о миграциях
    MIGRATION_LOG=$($DOCKER_COMPOSE_CMD logs backend 2>&1 | grep -i "миграц\|migration" | tail -5)
    if [ -n "$MIGRATION_LOG" ]; then
        print_info "Логи миграций:"
        echo "$MIGRATION_LOG"
    fi
fi

# Проверка существования таблиц
print_info "Проверка создания таблиц..."
TABLE_CHECK=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U ${POSTGRES_USER:-afrodita_user} -d ${POSTGRES_DB:-afrodita} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

if [ -n "$TABLE_CHECK" ] && [ "$TABLE_CHECK" -gt "0" ]; then
    print_success "Таблицы созданы ($TABLE_CHECK таблиц)"
else
    print_warning "Таблицы не найдены. Возможно, миграции не выполнены."
    print_info "Выполните миграции вручную:"
    echo "  $DOCKER_COMPOSE_CMD exec backend npm run migration:run"
fi

# Шаг 11: Финальная проверка
print_info "Шаг 11: Финальная проверка..."

# Проверка доступности сервисов
print_info "Проверка доступности сервисов..."

sleep 10

# Проверка health check
if curl -k -s https://${SERVER_IP}/health > /dev/null 2>&1; then
    print_success "Health check доступен"
else
    print_warning "Health check недоступен. Возможно, сервисы еще запускаются"
fi

# Итоговая информация
echo ""
echo "=========================================="
echo "  Развертывание завершено!"
echo "=========================================="
echo ""
print_success "Все сервисы запущены и работают"
echo ""
echo "Доступ к приложениям:"
echo "  Frontend:  ${GREEN}https://${SERVER_IP}${NC}"
echo "  Admin:     ${GREEN}https://${SERVER_IP}/admin${NC}"
echo "  Backend:   ${GREEN}https://${SERVER_IP}/api${NC}"
echo "  Health:    ${GREEN}https://${SERVER_IP}/health${NC}"
echo ""
echo "Важная информация:"
echo "  - Файл .env создан в корне проекта"
echo "  - SSL сертификат самоподписанный (браузер покажет предупреждение)"
echo "  - Для принятия сертификата нажмите 'Дополнительно' -> 'Перейти на сайт'"
echo ""
echo "Управление:"
echo "  Просмотр логов:    $DOCKER_COMPOSE_CMD logs -f"
echo "  Остановка:         $DOCKER_COMPOSE_CMD down"
echo "  Перезапуск:        $DOCKER_COMPOSE_CMD restart"
echo "  Статус:            $DOCKER_COMPOSE_CMD ps"
echo ""
print_warning "Не забудьте сохранить пароль PostgreSQL и JWT секреты в безопасном месте!"
echo ""

