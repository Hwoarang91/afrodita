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
    chmod 644 /etc/nginx/ssl/certificate.crt
    chmod 600 /etc/nginx/ssl/certificate.key
    echo "SSL сертификаты готовы к использованию"
fi

# Запуск Nginx
exec "$@"

