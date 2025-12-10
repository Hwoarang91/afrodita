FROM nginx:alpine

# Установка OpenSSL для генерации сертификатов
RUN apk add --no-cache openssl

# Создание директории для SSL сертификатов
RUN mkdir -p /etc/nginx/ssl

# Создание директории для скриптов
RUN mkdir -p /usr/local/bin

# Копирование конфигурации Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копирование скрипта обновления сертификата
COPY renew-ssl-cert.sh /usr/local/bin/renew-ssl-cert.sh
RUN chmod +x /usr/local/bin/renew-ssl-cert.sh

# Создание entrypoint скрипта для генерации сертификата при первом запуске
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

