#!/bin/sh
set -e

# Получение IP адреса из переменной окружения
SERVER_IP=${SERVER_IP:-localhost}

echo "Обновление самоподписанного SSL сертификата для ${SERVER_IP}..."

# Генерация нового сертификата
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/afrodita.key \
    -out /etc/nginx/ssl/afrodita.crt \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=Afrodita/CN=${SERVER_IP}"

# Установка прав
chmod 600 /etc/nginx/ssl/afrodita.key
chmod 644 /etc/nginx/ssl/afrodita.crt

echo "SSL сертификат успешно обновлен"

# Перезагрузка Nginx
if command -v nginx >/dev/null 2>&1; then
    nginx -s reload
    echo "Nginx перезагружен"
fi

