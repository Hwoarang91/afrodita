#!/bin/sh
set -e

# Проверка наличия SSL сертификата
if [ ! -f /etc/nginx/ssl/afrodita.crt ] || [ ! -f /etc/nginx/ssl/afrodita.key ]; then
    echo "Генерация самоподписанного SSL сертификата..."
    
    # Получение IP адреса из переменной окружения или использование значения по умолчанию
    SERVER_IP=${SERVER_IP:-localhost}
    
    # Генерация сертификата
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/afrodita.key \
        -out /etc/nginx/ssl/afrodita.crt \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=Afrodita/CN=${SERVER_IP}"
    
    # Установка прав
    chmod 600 /etc/nginx/ssl/afrodita.key
    chmod 644 /etc/nginx/ssl/afrodita.crt
    
    echo "SSL сертификат успешно создан для ${SERVER_IP}"
else
    echo "SSL сертификат уже существует, пропускаем генерацию"
fi

# Запуск Nginx
exec "$@"

