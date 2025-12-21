#!/bin/bash

# Скрипт для обновления кода на сервере, пересборки и запуска проекта
# Использование: ssh root@194.87.54.64 < update-server.sh
# Или выполните команды вручную на сервере

set -e

echo "=========================================="
echo "Обновление кода на сервере"
echo "=========================================="

# Переход в директорию проекта
cd /root/afrodita || cd /root/Afrodita

echo "Текущая директория: $(pwd)"

# Обновление кода из GitHub
echo "Обновление кода из GitHub..."
git pull origin main

# Остановка контейнеров
echo "Остановка контейнеров..."
docker compose down

# Пересборка образов без кеша
echo "Пересборка Docker образов без кеша..."
docker compose build --no-cache

# Запуск контейнеров
echo "Запуск контейнеров..."
docker compose up -d

# Ожидание запуска
echo "Ожидание запуска сервисов..."
sleep 15

# Проверка статуса
echo "=========================================="
echo "Проверка статуса контейнеров..."
echo "=========================================="
docker compose ps

# Проверка логов
echo "=========================================="
echo "Проверка логов контейнеров (последние 50 строк)..."
echo "=========================================="

echo ""
echo "--- Логи Backend ---"
docker compose logs --tail=50 backend

echo ""
echo "--- Логи Admin ---"
docker compose logs --tail=50 admin

echo ""
echo "--- Логи App ---"
docker compose logs --tail=50 app

echo ""
echo "--- Логи Nginx ---"
docker compose logs --tail=50 nginx

echo ""
echo "--- Логи Postgres ---"
docker compose logs --tail=50 postgres

echo ""
echo "--- Логи Redis ---"
docker compose logs --tail=50 redis

echo "=========================================="
echo "Обновление завершено"
echo "=========================================="

echo ""
echo "Для просмотра логов в реальном времени используйте:"
echo "  docker compose logs -f [service_name]"
echo ""
echo "Для просмотра всех логов:"
echo "  docker compose logs -f"
