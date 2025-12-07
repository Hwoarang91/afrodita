## Инструкции по деплою на сервер

### Автоматизированное развертывание (рекомендуется)

Для упрощения процесса развертывания создан автоматизированный скрипт, который:
- Настраивает firewall
- Генерирует секретные ключи и заполняет .env файл
- Выпускает самоподписанный SSL сертификат
- Настраивает Nginx внутри Docker
- Запускает все сервисы

**Преимущества:**
- Nginx работает внутри Docker контейнера (изоляция, простое управление)
- Все настройки автоматизированы
- Минимальное ручное вмешательство
- Единая точка управления всеми сервисами

**Требования:**
- Ubuntu/Debian сервер
- Установленный Docker и Docker Compose
- Права sudo
- IP адрес сервера

**Использование:**

```bash
# 1. Клонируйте репозиторий на сервер
git clone <your-repo-url>
cd Afrodita

# 2. Запустите скрипт развертывания
chmod +x deploy.sh
./deploy.sh

# Скрипт задаст вопросы:
# - IP адрес сервера (по умолчанию: 194.87.54.64)
# - Пароль для PostgreSQL
# - Токен Telegram бота (опционально)
# - Автоматически сгенерирует JWT секреты
# - Настроит firewall
# - Создаст SSL сертификат
# - Запустит все контейнеры
```

**Что делает скрипт:**
1. Проверяет наличие Docker и Docker Compose
2. Настраивает firewall (открывает порты 80, 443, 22)
3. Генерирует JWT секреты
4. Создает .env файл с вашими данными
5. Генерирует самоподписанный SSL сертификат
6. Создает конфигурацию Nginx
7. Собирает и запускает все Docker контейнеры
8. Выполняет миграции базы данных

**Структура после развертывания:**
```
docker-compose.yml          # Основной файл с nginx сервисом
nginx/
  ├── Dockerfile            # Dockerfile для Nginx
  ├── nginx.conf            # Основная конфигурация
  └── ssl/                  # SSL сертификаты (создаются автоматически)
deploy.sh                   # Скрипт автоматического развертывания
.env                        # Файл окружения (создается автоматически)
```

**Порты после развертывания:**
- `80` - HTTP (редирект на HTTPS)
- `443` - HTTPS (основной доступ)
- `3000` - Frontend (только внутри Docker сети)
- `3001` - Backend API (только внутри Docker сети)
- `3002` - Admin панель (только внутри Docker сети)

**Доступ к приложениям:**
- Frontend: `https://194.87.54.64`
- Admin: `https://194.87.54.64/admin`
- Backend API: `https://194.87.54.64/api`
- Health check: `https://194.87.54.64/health`

**Обновление после развертывания:**

```bash
# Обновление кода
git pull

# Пересборка и перезапуск
docker-compose build
docker-compose up -d

# Применение миграций
docker-compose exec backend npm run migration:run
```

**Ручное управление:**

```bash
# Просмотр логов
docker-compose logs -f

# Остановка всех сервисов
docker-compose down

# Перезапуск конкретного сервиса
docker-compose restart nginx
docker-compose restart backend

# Обновление SSL сертификата (если истек)
docker-compose exec nginx /usr/local/bin/renew-ssl-cert.sh
```

### Ручное развертывание (альтернативный способ)

Если вы предпочитаете настраивать все вручную или используете внешний Nginx:

### Настройка .env файла

Создайте файл `.env` в корне проекта со следующими переменными:

```env
# База данных PostgreSQL
POSTGRES_USER=afrodita_user
POSTGRES_PASSWORD=your_strong_password_here
POSTGRES_DB=afrodita
POSTGRES_PORT=5432
DB_HOST=postgres
DB_PORT=5432
DB_USER=afrodita_user
DB_PASSWORD=your_strong_password_here
DB_NAME=afrodita
DB_SSL=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT токены (сгенерируйте случайные строки)
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_min_32_chars

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEB_APP_URL=https://194.87.54.64

# URLs приложений (замените на ваш домен или IP)
FRONTEND_URL=https://194.87.54.64:3000
ADMIN_URL=https://194.87.54.64:3002
BACKEND_URL=https://194.87.54.64:3001

# Порты для сервисов
BACKEND_PORT=3001
FRONTEND_PORT=3000
ADMIN_PORT=3002

# Окружение
NODE_ENV=production

# Часовой пояс
TZ=Europe/Moscow
```

**Важно:**
- Замените `your_strong_password_here` на надежный пароль для PostgreSQL
- Замените `your_jwt_secret_key_min_32_chars` и `your_jwt_refresh_secret_key_min_32_chars` на случайные строки минимум 32 символа
- Замените `your_telegram_bot_token` на токен вашего Telegram бота (получите у @BotFather)
- Если у вас есть домен, замените IP адрес `194.87.54.64` на доменное имя

### Генерация секретных ключей

Для генерации JWT секретов используйте:

```bash
# Linux/Mac
openssl rand -base64 32

# Или через Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Открытие портов в firewall

#### Ubuntu/Debian (ufw)

```bash
# Установка ufw (если не установлен)
sudo apt update
sudo apt install ufw -y

# Разрешить SSH (важно сделать первым!)
sudo ufw allow 22/tcp

# Разрешить порты для приложения
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3001/tcp  # Backend API
sudo ufw allow 3002/tcp  # Admin панель

# Если используете HTTPS через Nginx (рекомендуется)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

#### CentOS/RHEL (firewalld)

```bash
# Разрешить порты
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=3002/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp

# Применить изменения
sudo firewall-cmd --reload

# Проверить статус
sudo firewall-cmd --list-ports
```

#### Проверка открытых портов

```bash
# Проверить, что порты слушаются
sudo netstat -tulpn | grep -E ':(3000|3001|3002|80|443)'

# Или через ss
sudo ss -tulpn | grep -E ':(3000|3001|3002|80|443)'
```

### Настройка HTTPS через Nginx (рекомендуется)

#### 1. Установка Nginx и Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx -y
```

#### 2. Настройка Nginx для Frontend

Создайте файл `/etc/nginx/sites-available/afrodita-frontend`:

```nginx
server {
    listen 80;
    server_name 194.87.54.64;  # Замените на ваш домен, если есть

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. Настройка Nginx для Admin панели

Создайте файл `/etc/nginx/sites-available/afrodita-admin`:

```nginx
server {
    listen 80;
    server_name admin.194.87.54.64;  # Замените на ваш домен, если есть

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. Настройка Nginx для Backend API

Создайте файл `/etc/nginx/sites-available/afrodita-backend`:

```nginx
server {
    listen 80;
    server_name api.194.87.54.64;  # Замените на ваш домен, если есть

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5. Активация конфигураций

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/afrodita-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/afrodita-admin /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/afrodita-backend /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

#### 6. Получение SSL сертификата (Let's Encrypt)

**Важно:** Для получения SSL сертификата нужен домен. Если у вас только IP адрес, используйте самоподписанный сертификат (см. раздел ниже).

```bash
# Если у вас есть домен (например, example.com)
sudo certbot --nginx -d example.com -d www.example.com
sudo certbot --nginx -d admin.example.com
sudo certbot --nginx -d api.example.com

# Автоматическое обновление сертификата
sudo certbot renew --dry-run
```

#### 7. Настройка автообновления сертификата

```bash
# Проверка таймера автообновления
sudo systemctl status certbot.timer

# Если не активен, включите
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Настройка HTTPS без домена (самоподписанный сертификат) - ПОДРОБНАЯ ИНСТРУКЦИЯ

#### Шаг 1: Установка OpenSSL (если не установлен)

```bash
# Проверка установки OpenSSL
openssl version

# Если не установлен, установите:
# Ubuntu/Debian
sudo apt update
sudo apt install openssl -y

# CentOS/RHEL
sudo yum install openssl -y
```

#### Шаг 2: Создание директории для сертификатов

```bash
# Создание директории для SSL сертификатов
sudo mkdir -p /etc/nginx/ssl

# Проверка создания директории
ls -la /etc/nginx/ssl
```

#### Шаг 3: Генерация самоподписанного сертификата

**Вариант 1: Быстрая генерация (для тестирования)**

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/afrodita.key \
  -out /etc/nginx/ssl/afrodita.crt \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=Afrodita/CN=194.87.54.64"
```

**Вариант 2: Интерактивная генерация (рекомендуется)**

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/afrodita.key \
  -out /etc/nginx/ssl/afrodita.crt
```

При интерактивной генерации вам будут заданы вопросы:

```
Country Name (2 letter code) [AU]: RU
State or Province Name (full name) [Some-State]: Moscow
Locality Name (eg, city) []: Moscow
Organization Name (eg, company) [Internet Widgits Pty Ltd]: Afrodita
Organizational Unit Name (eg, section) []: IT Department
Common Name (e.g. server FQDN or YOUR name) []: 194.87.54.64
Email Address []: admin@afrodita.local
```

**Важно:** В поле "Common Name" обязательно укажите ваш IP адрес: `194.87.54.64`

#### Шаг 4: Установка правильных прав доступа

```bash
# Установка прав только для чтения для владельца (root)
sudo chmod 600 /etc/nginx/ssl/afrodita.key
sudo chmod 644 /etc/nginx/ssl/afrodita.crt

# Установка владельца (nginx должен иметь доступ)
sudo chown root:root /etc/nginx/ssl/afrodita.key
sudo chown root:root /etc/nginx/ssl/afrodita.crt

# Проверка прав
ls -la /etc/nginx/ssl/
```

Вы должны увидеть:
```
-rw------- 1 root root 1704 Dec  7 12:00 afrodita.key
-rw-r--r-- 1 root root 1334 Dec  7 12:00 afrodita.crt
```

#### Шаг 5: Создание конфигурации Nginx для Frontend

Создайте файл `/etc/nginx/sites-available/afrodita-frontend-ssl`:

```bash
sudo nano /etc/nginx/sites-available/afrodita-frontend-ssl
```

Вставьте следующую конфигурацию:

```nginx
# HTTPS сервер для Frontend
server {
    listen 443 ssl http2;
    server_name 194.87.54.64;

    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/afrodita.crt;
    ssl_certificate_key /etc/nginx/ssl/afrodita.key;

    # SSL настройки безопасности
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Проксирование на Frontend контейнер
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name 194.87.54.64;
    
    # Редирект всех запросов на HTTPS
    return 301 https://$server_name$request_uri;
}
```

Сохраните файл: `Ctrl+O`, затем `Enter`, затем `Ctrl+X`

#### Шаг 6: Создание конфигурации Nginx для Admin панели

```bash
sudo nano /etc/nginx/sites-available/afrodita-admin-ssl
```

Вставьте конфигурацию:

```nginx
# HTTPS сервер для Admin панели
server {
    listen 443 ssl http2;
    server_name 194.87.54.64;

    # SSL сертификаты (используем те же)
    ssl_certificate /etc/nginx/ssl/afrodita.crt;
    ssl_certificate_key /etc/nginx/ssl/afrodita.key;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosnoshiff" always;

    # Проксирование на Admin контейнер
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Альтернативный вариант:** Использовать разные порты для Admin (например, 8443):

```nginx
server {
    listen 8443 ssl http2;
    server_name 194.87.54.64;
    # ... остальная конфигурация такая же
}
```

#### Шаг 7: Создание конфигурации Nginx для Backend API

```bash
sudo nano /etc/nginx/sites-available/afrodita-backend-ssl
```

Вставьте конфигурацию:

```nginx
# HTTPS сервер для Backend API
server {
    listen 443 ssl http2;
    server_name 194.87.54.64;

    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/afrodita.crt;
    ssl_certificate_key /etc/nginx/ssl/afrodita.key;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;

    # Проксирование на Backend контейнер
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        access_log off;
    }
}
```

**Вариант с использованием подпутей (рекомендуется):**

Если вы хотите использовать один порт 443 для всех сервисов:

```bash
sudo nano /etc/nginx/sites-available/afrodita-all-ssl
```

```nginx
# Единый HTTPS сервер для всех сервисов
server {
    listen 443 ssl http2;
    server_name 194.87.54.64;

    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/afrodita.crt;
    ssl_certificate_key /etc/nginx/ssl/afrodita.key;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend (основной путь)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin панель
    location /admin {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health checks
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        access_log off;
    }
}

# Редирект HTTP на HTTPS
server {
    listen 80;
    server_name 194.87.54.64;
    return 301 https://$server_name$request_uri;
}
```

#### Шаг 8: Активация конфигураций

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/afrodita-all-ssl /etc/nginx/sites-enabled/

# Или если используете отдельные конфигурации:
# sudo ln -s /etc/nginx/sites-available/afrodita-frontend-ssl /etc/nginx/sites-enabled/
# sudo ln -s /etc/nginx/sites-available/afrodita-admin-ssl /etc/nginx/sites-enabled/
# sudo ln -s /etc/nginx/sites-available/afrodita-backend-ssl /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации (если есть)
sudo rm -f /etc/nginx/sites-enabled/default

# Проверка синтаксиса конфигурации
sudo nginx -t
```

Если проверка прошла успешно, вы увидите:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

#### Шаг 9: Перезагрузка Nginx

```bash
# Перезагрузка конфигурации без остановки сервиса
sudo systemctl reload nginx

# Или полный перезапуск
sudo systemctl restart nginx

# Проверка статуса
sudo systemctl status nginx
```

#### Шаг 10: Проверка работы HTTPS

```bash
# Проверка через curl (с игнорированием проверки сертификата)
curl -k https://194.87.54.64/health

# Проверка через wget
wget --no-check-certificate https://194.87.54.64/health

# Проверка открытых портов
sudo netstat -tulpn | grep :443
```

#### Шаг 11: Обновление .env файла

Обновите ваш `.env` файл:

```env
# URLs приложений с HTTPS
FRONTEND_URL=https://194.87.54.64
ADMIN_URL=https://194.87.54.64
BACKEND_URL=https://194.87.54.64/api

# Или если используете подпути:
# FRONTEND_URL=https://194.87.54.64
# ADMIN_URL=https://194.87.54.64/admin
# BACKEND_URL=https://194.87.54.64/api
```

#### Шаг 12: Перезапуск Docker контейнеров

```bash
cd /path/to/your/project
docker-compose down
docker-compose up -d
```

#### Шаг 13: Настройка браузера для работы с самоподписанным сертификатом

**Важно:** Браузеры будут показывать предупреждение о небезопасном соединении. Это нормально для самоподписанных сертификатов.

**Chrome/Edge:**
1. Откройте `https://194.87.54.64`
2. Нажмите "Дополнительно" или "Advanced"
3. Нажмите "Перейти на сайт (небезопасно)" или "Proceed to 194.87.54.64 (unsafe)"

**Firefox:**
1. Откройте `https://194.87.54.64`
2. Нажмите "Дополнительно" или "Advanced"
3. Нажмите "Принять риск и продолжить" или "Accept the Risk and Continue"

**Импорт сертификата в браузер (опционально, для устранения предупреждения):**

```bash
# Скачайте сертификат на локальный компьютер
scp root@194.87.54.64:/etc/nginx/ssl/afrodita.crt ./

# Или скопируйте содержимое
cat /etc/nginx/ssl/afrodita.crt
```

Затем импортируйте в браузер:
- **Chrome:** Настройки → Конфиденциальность и безопасность → Безопасность → Управление сертификатами → Доверенные корневые центры сертификации → Импортировать
- **Firefox:** Настройки → Конфиденциальность и защита → Сертификаты → Просмотр сертификатов → Авторитеты → Импортировать

#### Шаг 14: Настройка автоматического обновления сертификата (опционально)

Самоподписанный сертификат действителен 365 дней. Для автоматического обновления создайте скрипт:

```bash
sudo nano /usr/local/bin/renew-ssl-cert.sh
```

```bash
#!/bin/bash
# Скрипт обновления самоподписанного SSL сертификата

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/afrodita.key \
  -out /etc/nginx/ssl/afrodita.crt \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=Afrodita/CN=194.87.54.64"

chmod 600 /etc/nginx/ssl/afrodita.key
chmod 644 /etc/nginx/ssl/afrodita.crt

systemctl reload nginx

echo "SSL certificate renewed successfully"
```

```bash
# Сделать скрипт исполняемым
sudo chmod +x /usr/local/bin/renew-ssl-cert.sh

# Добавить в cron для автоматического обновления за 30 дней до истечения
sudo crontab -e
```

Добавьте строку:
```
0 0 1 * * /usr/local/bin/renew-ssl-cert.sh
```

#### Шаг 15: Устранение проблем

**Проблема: Nginx не запускается**

```bash
# Проверка логов
sudo tail -f /var/log/nginx/error.log

# Проверка синтаксиса
sudo nginx -t

# Проверка прав на сертификаты
ls -la /etc/nginx/ssl/
```

**Проблема: "SSL: error:0B080074:x509 certificate routines"**

Это означает, что сертификат не найден или поврежден. Пересоздайте:

```bash
sudo rm /etc/nginx/ssl/afrodita.*
# Повторите Шаг 3
```

**Проблема: Браузер не подключается**

```bash
# Проверьте firewall
sudo ufw status
sudo ufw allow 443/tcp

# Проверьте, что Nginx слушает порт 443
sudo netstat -tulpn | grep :443
```

**Проблема: "502 Bad Gateway"**

```bash
# Проверьте, что Docker контейнеры запущены
docker-compose ps

# Проверьте логи контейнеров
docker-compose logs backend
docker-compose logs frontend
docker-compose logs admin
```

#### Шаг 16: Проверка безопасности SSL

```bash
# Проверка через openssl
echo | openssl s_client -connect 194.87.54.64:443 -servername 194.87.54.64 2>/dev/null | openssl x509 -noout -dates

# Проверка через SSL Labs (требует домен)
# https://www.ssllabs.com/ssltest/
```

#### Итоговая проверка

После выполнения всех шагов проверьте:

```bash
# 1. Nginx работает
sudo systemctl status nginx

# 2. Порт 443 открыт
sudo netstat -tulpn | grep :443

# 3. Сертификат валиден
curl -k -v https://194.87.54.64 2>&1 | grep -i "SSL\|certificate"

# 4. Редирект с HTTP на HTTPS работает
curl -I http://194.87.54.64

# 5. Все сервисы доступны
curl -k https://194.87.54.64/health
curl -k https://194.87.54.64/api/v1/health
```

Если все проверки прошли успешно, HTTPS настроен и работает!

### Обновление .env после настройки HTTPS

После настройки HTTPS обновите `.env`:

```env
# URLs приложений с HTTPS
FRONTEND_URL=https://194.87.54.64
ADMIN_URL=https://194.87.54.64:3002
BACKEND_URL=https://194.87.54.64:3001

# Или если используете домен
FRONTEND_URL=https://example.com
ADMIN_URL=https://admin.example.com
BACKEND_URL=https://api.example.com
```

### Проверка работы

```bash
# Проверка доступности сервисов
curl http://194.87.54.64:3000/health
curl http://194.87.54.64:3001/health
curl http://194.87.54.64:3002

# Проверка через HTTPS (если настроен)
curl -k https://194.87.54.64/health
```

### Безопасность

1. **Не открывайте порты PostgreSQL и Redis наружу:**
   - Они должны быть доступны только внутри Docker сети
   - Убедитесь, что в `docker-compose.yml` они не проброшены на внешний интерфейс

2. **Используйте сильные пароли:**
   - Минимум 16 символов
   - Комбинация букв, цифр и специальных символов

3. **Регулярно обновляйте систему:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Настройте fail2ban для защиты от брутфорса:**
   ```bash
   sudo apt install fail2ban -y
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

### Мониторинг

```bash
# Просмотр логов Docker контейнеров
docker-compose logs -f

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Проверка статуса сервисов
docker-compose ps
sudo systemctl status nginx
```

### Резервное копирование

```bash
# Бэкап базы данных
docker-compose exec postgres pg_dump -U afrodita_user afrodita > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
docker-compose exec -T postgres psql -U afrodita_user afrodita < backup_20231207.sql
```

