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

# Шаг 10: Выполнение миграций
print_info "Шаг 10: Выполнение миграций базы данных..."

# Ждем готовности базы данных
print_info "Ожидание готовности PostgreSQL..."
for i in {1..30}; do
    if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U afrodita_user > /dev/null 2>&1; then
        print_success "PostgreSQL готов"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL не готов после 30 попыток"
        exit 1
    fi
    sleep 2
done

# Выполнение миграций
print_info "Применение миграций..."
$DOCKER_COMPOSE_CMD exec -T backend npm run migration:run

if [ $? -ne 0 ]; then
    print_warning "Возможна ошибка при выполнении миграций. Проверьте логи:"
    echo "  docker-compose logs backend"
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

