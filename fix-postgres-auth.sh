#!/bin/bash

# Скрипт для исправления проблемы с аутентификацией PostgreSQL

set -e

print_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[0;33m[WARNING]\033[0m $1"
}

# Проверка наличия .env файла
if [ ! -f .env ]; then
    print_error "Файл .env не найден!"
    exit 1
fi

# Загрузка переменных из .env
source .env

print_info "Проверка конфигурации PostgreSQL..."

# Проверка совпадения паролей
if [ "$POSTGRES_PASSWORD" != "$DB_PASSWORD" ]; then
    print_error "Пароли не совпадают!"
    print_error "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:3}..."
    print_error "DB_PASSWORD: ${DB_PASSWORD:0:3}..."
    print_warning "Исправьте .env файл, чтобы POSTGRES_PASSWORD и DB_PASSWORD совпадали"
    exit 1
fi

# Проверка совпадения пользователей
if [ "$POSTGRES_USER" != "$DB_USER" ]; then
    print_error "Пользователи не совпадают!"
    print_error "POSTGRES_USER: $POSTGRES_USER"
    print_error "DB_USER: $DB_USER"
    print_warning "Исправьте .env файл, чтобы POSTGRES_USER и DB_USER совпадали"
    exit 1
fi

print_success "Конфигурация .env файла корректна"

# Проверка статуса контейнеров
print_info "Проверка статуса контейнеров..."

if ! docker compose ps postgres | grep -q "Up"; then
    print_warning "PostgreSQL контейнер не запущен. Запускаю..."
    docker compose up -d postgres
    print_info "Ожидание готовности PostgreSQL..."
    sleep 10
fi

# Проверка подключения с текущими учетными данными
print_info "Проверка подключения к PostgreSQL..."

if docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Подключение успешно!"
    exit 0
fi

print_warning "Не удалось подключиться с текущими учетными данными"

# Попытка подключиться как postgres (суперпользователь)
print_info "Попытка подключиться как суперпользователь postgres..."

if docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Подключение как postgres успешно"
    
    # Создание пользователя и базы данных
    print_info "Создание пользователя и базы данных..."
    
    docker compose exec -T postgres psql -U postgres <<EOF
-- Создание пользователя (если не существует)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$POSTGRES_USER') THEN
        CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
        ALTER USER $POSTGRES_USER CREATEDB;
        RAISE NOTICE 'Пользователь $POSTGRES_USER создан';
    ELSE
        ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
        RAISE NOTICE 'Пароль пользователя $POSTGRES_USER обновлен';
    END IF;
END
\$\$;

-- Создание базы данных (если не существует)
SELECT 'CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$POSTGRES_DB')\gexec

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
\c $POSTGRES_DB
GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
EOF

    print_success "Пользователь и база данных настроены"
    
    # Проверка подключения
    print_info "Проверка подключения с новыми учетными данными..."
    if docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Подключение успешно!"
        print_info "Перезапускаю backend..."
        docker compose restart backend
        exit 0
    else
        print_error "Не удалось подключиться после создания пользователя"
        exit 1
    fi
else
    print_error "Не удалось подключиться как postgres"
    print_warning "Возможно, нужно пересоздать volume PostgreSQL"
    print_info "Выполните следующие команды:"
    echo "  docker compose down"
    echo "  docker volume rm afrodita_postgres_data"
    echo "  docker compose up -d postgres"
    echo "  ./fix-postgres-auth.sh"
    exit 1
fi

