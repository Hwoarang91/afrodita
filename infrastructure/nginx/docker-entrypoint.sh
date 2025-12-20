#!/bin/sh
set -e

# Проверка наличия SSL сертификата
# Отключена автоматическая генерация - используем сертификаты из папки ssl
if [ ! -f /etc/nginx/ssl/certificate.crt ] || [ ! -f /etc/nginx/ssl/certificate.key ]; then
    echo "ОШИБКА: SSL сертификаты не найдены!"
    echo "Ожидаются файлы:"
    echo "  - /etc/nginx/ssl/certificate.crt"
    echo "  - /etc/nginx/ssl/certificate.key"
    echo "Пожалуйста, убедитесь, что сертификаты смонтированы в контейнер."
    exit 1
else
    echo "SSL сертификаты найдены, проверяем права доступа..."
    # Проверяем права доступа без изменения (для read-only volumes)
    if [ -r /etc/nginx/ssl/certificate.crt ] && [ -r /etc/nginx/ssl/certificate.key ]; then
        echo "SSL сертификаты доступны для чтения"
    else
        echo "ОШИБКА: SSL сертификаты не доступны для чтения!"
        exit 1
    fi
    echo "SSL сертификаты готовы к использованию"
fi

# Запуск Nginx
exec "$@"

