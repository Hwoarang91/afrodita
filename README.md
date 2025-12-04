# Афродита - Telegram-бот и Web App для массажного салона

## Инструкции по запуску

### Запуск через Docker

#### Тестирование и разработка (docker-compose.dev.yml)

```bash
# Сборка контейнеров
docker-compose -f docker-compose.dev.yml build

# Запуск в фоновом режиме
docker-compose -f docker-compose.dev.yml up -d

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f

# Остановка
docker-compose -f docker-compose.dev.yml down
```

**Особенности dev режима:**
- Hot-reload для всех сервисов
- Volumes для разработки
- Development Dockerfile

#### Деплой в продакшен (docker-compose.yml)

```bash
# Сборка контейнеров
docker-compose build

# Запуск в фоновом режиме
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

**Особенности production режима:**
- Оптимизированные production образы
- Multi-stage builds
- Production Dockerfile

### Локальный запуск

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev

# Admin
cd admin
npm install
npm run dev
```

### Запуск в продакшен на выделенном сервере Ubuntu

```bash
# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env и заполните необходимые переменные

# Запуск через Docker Compose (PRODUCTION)
docker-compose build
docker-compose up -d

# Выполнение миграций
docker-compose exec backend npm run migration:run

# Заполнение тестовыми данными (опционально)
docker-compose exec backend npm run seed

# Просмотр логов
docker-compose logs -f
```

### Тестирование на локальной машине

```bash
# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env и заполните необходимые переменные

# Запуск через Docker Compose (DEVELOPMENT)
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d

# Выполнение миграций
docker-compose -f docker-compose.dev.yml exec backend npm run migration:run

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f
```

## Отчет о проделанной работе

### Изменения

**Интеграция shadcn/ui:**
- ✅ Подключен shadcn/ui для Admin Panel и Frontend
- ✅ Обновлена конфигурация Tailwind с дефолтными цветами для темной темы
- ✅ Рефакторинг компонентов Admin Panel с использованием shadcn/ui
- ✅ Рефакторинг компонентов Frontend с использованием shadcn/ui
- ✅ Проверка и обновление всех страниц на корректную работу темной темы

**Исправления ошибок:**
- ✅ Исправлена ошибка компиляции в `app/appointments/page.tsx` (незакрытый CardContent)
- ✅ Исправлен импорт CSS для react-quill (перенесен в globals.css)
- ✅ Исправлена ошибка позиционирования @import в CSS (должен быть первым)

**Реорганизация документации:**
- ✅ Все .md файлы (кроме /content) собраны в один README.md
- ✅ Удалены дублирующиеся файлы документации
- ✅ Сохранена папка /content с контентными материалами

### Что сделал ИИ

**Созданные файлы:**
- ✅ `admin/components/ui/dialog.tsx` - компонент Dialog для модальных окон

**Измененные файлы:**
- ✅ `admin/app/dashboard/page.tsx` - рефакторинг с использованием shadcn/ui компонентов
- ✅ `admin/app/clients/page.tsx` - рефакторинг с использованием shadcn/ui компонентов
- ✅ `admin/app/services/page.tsx` - рефакторинг с использованием shadcn/ui компонентов
- ✅ `admin/app/appointments/page.tsx` - рефакторинг с использованием shadcn/ui компонентов, исправление ошибок
- ✅ `admin/app/mailings/page.tsx` - удален динамический импорт CSS
- ✅ `admin/app/globals.css` - добавлен импорт react-quill CSS
- ✅ `frontend/src/pages/Services.tsx` - обновлены классы для shadcn/ui
- ✅ `frontend/src/pages/Auth.tsx` - обновлены классы для shadcn/ui
- ✅ `README.md` - полная переработка, объединение всей документации

**Удаленные файлы:**
- ✅ `.md/INDEX.md`
- ✅ `.md/afrodita.md`
- ✅ `.md/report.md`
- ✅ `.md/SETUP.md`
- ✅ `.md/BACKEND-TODO.md`
- ✅ `.md/FRONTEND-ADMIN-TODO.md`
- ✅ `.md/TESTING-AUTH.md`
- ✅ `.md/backend/TELEGRAM_BOT_CHECK.md`
- ✅ `.md/docker/DOCKER-DEV.md`
- ✅ `.md/docker/DOCKER-COMMANDS.md`
- ✅ `.md/design-system/colors.md`
- ✅ `.md/design-system/typography.md`

### Статус задачи

**done ✅**
- Интеграция shadcn/ui для Admin Panel и Frontend
- Рефакторинг стилей и цветов
- Возврат реализации темной темы с цветами по умолчанию
- Проверка реализации на всех страницах
- Исправление ошибок компиляции
- Реорганизация документации

### Следующие шаги

- Настройка production окружения
- Финальное тестирование всех сценариев
- Оптимизация производительности
- Настройка мониторинга (Sentry, Prometheus)
- Настройка CI/CD

## Общая информация

### Назначение проекта

Полнофункциональная система для управления записями в массажном салоне, включающая:
- Telegram-бот с командами, клавиатурами и календарем
- Клиентское Web App на React + TypeScript
- Административную панель на Next.js
- Backend API на NestJS

### Технологический стек

**Backend:**
- NestJS 10.3.0 (TypeScript)
- PostgreSQL 15 (TypeORM 0.3.17)
- Redis 7, BullMQ 5.3.0
- Telegraf 4.15.4 (Telegram Bot API)
- Socket.IO 4.7.2 (WebSocket)
- JWT аутентификация
- Swagger/OpenAPI документация

**Frontend:**
- React 18.2.0 + TypeScript
- Vite 7.2.4
- Zustand 4.4.7 (state management)
- React Query 5.14.2 (data fetching)
- Tailwind CSS 3.4.0
- Telegram WebApp SDK

**Admin Panel:**
- Next.js 14.2.33 (App Router)
- TypeScript 5.3.3
- shadcn/ui компоненты
- ApexCharts 4.0.0 (графики)
- React Quill 2.0.0 (WYSIWYG редактор)
- Tailwind CSS 3.4.0

**Инфраструктура:**
- Docker, Docker Compose
- PostgreSQL 15-alpine
- Redis 7-alpine
- Node.js 20-alpine

### Архитектура

Монолитная архитектура с разделением на модули:
- RESTful API
- JWT аутентификация
- Role-based access control (RBAC)
- Модульная структура: services, controllers, entities, DTOs
- WebSocket для real-time обновлений

### Важные детали

- Часовой пояс: Europe/Moscow (TZ: Europe/Moscow)
- Поддержка темной темы в админ-панели
- Форматирование сообщений Telegram: HTML, Markdown, MarkdownV2
- Система переменных в сообщениях: {first_name}, {last_name}, {username}, {user_id}, {chat_id}, {chat_title}, {date}, {time}
- Поддержка всех типов медиа в Telegram: текст, фото, видео, аудио, документы, стикеры, локация, опросы

## BACKEND

### Как запускать backend

**Через Docker (Development):**
```bash
docker-compose -f docker-compose.dev.yml up -d backend
docker-compose -f docker-compose.dev.yml logs -f backend
```

**Через Docker (Production):**
```bash
docker-compose up -d backend
docker-compose logs -f backend
```

**Локально:**
```bash
cd backend
npm install
npm run start:dev
```

**Выполнение миграций:**
```bash
# В Docker (Development)
docker-compose -f docker-compose.dev.yml exec backend npm run migration:run

# В Docker (Production)
docker-compose exec backend npm run migration:run

# Локально
cd backend
npm run migration:run
```

### Структура директорий

```
backend/
├── src/
│   ├── modules/          # Модули приложения
│   │   ├── auth/        # Аутентификация
│   │   ├── users/       # Управление пользователями
│   │   ├── appointments/# Система бронирования
│   │   ├── services/    # Услуги
│   │   ├── masters/     # Мастера
│   │   ├── notifications/# Уведомления
│   │   ├── telegram/    # Telegram бот
│   │   ├── settings/   # Настройки системы
│   │   └── analytics/  # Аналитика
│   ├── entities/        # TypeORM сущности
│   ├── config/         # Конфигурация
│   └── main.ts         # Точка входа
├── Dockerfile
├── Dockerfile.dev
└── package.json
```

### Важные модули

**Аутентификация (`auth`):**
- Telegram Login (валидация данных WebApp)
- JWT токены (access + refresh)
- Система ролей (client, admin, master)
- Валидация телефона
- Логирование авторизации

**Система бронирования (`appointments`):**
- Проверка занятости слотов
- Расписание мастеров
- FSM для процесса записи
- Перенос и отмена записей
- Генерация доступных слотов

**Telegram бот (`telegram`):**
- Команды: /start, /help, /book, /appointments, /services, /profile, /cancel
- Reply клавиатура (главное меню)
- Inline клавиатуры (выбор услуг, мастеров, времени)
- Интерактивный календарь
- Сессии пользователей
- Полный процесс записи через бота
- Поддержка форматирования: HTML, Markdown, MarkdownV2
- Система переменных в сообщениях

**Уведомления (`notifications`):**
- Telegram Push через Bot API
- Шаблонизатор Handlebars
- Типы: подтверждение, напоминание, отмена, перенос, бонусы, отзывы, рассылки
- История рассылок

**Настройки (`settings`):**
- Настройка подтверждения записей (автоматическое/ручное)
- Приветственное сообщение для групп
- Сообщение для команды /start
- Интервал автоматического обновления чатов
- Часовой пояс и рабочие часы

### Зависимости

Основные зависимости:
- @nestjs/common, @nestjs/core, @nestjs/platform-express
- @nestjs/typeorm, typeorm, pg
- @nestjs/jwt, passport, passport-jwt
- telegraf
- ioredis, bullmq
- socket.io, @nestjs/websockets
- class-validator, class-transformer
- winston, nest-winston

### Пример .env

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=afrodita

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Server
PORT=3001
NODE_ENV=development

# Timezone
TZ=Europe/Moscow
```

### Архитектура модулей

Каждый модуль содержит:
- `*.module.ts` - определение модуля
- `*.service.ts` - бизнес-логика
- `*.controller.ts` - HTTP endpoints
- `*.entity.ts` - TypeORM сущность
- `*.dto.ts` - Data Transfer Objects
- `*.guard.ts` - guards для защиты маршрутов

## FRONTEND

### Как запускать frontend

**Через Docker:**
```bash
docker-compose -f docker-compose.dev.yml up -d frontend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

**Локально:**
```bash
cd frontend
npm install
npm run dev
```

### Структура файлов

```
frontend/
├── src/
│   ├── pages/           # Страницы приложения
│   │   ├── Services.tsx
│   │   ├── Calendar.tsx
│   │   ├── Profile.tsx
│   │   └── ...
│   ├── components/      # React компоненты
│   │   ├── ui/         # shadcn/ui компоненты
│   │   └── ...
│   ├── api/            # API клиенты
│   ├── store/          # Zustand store
│   ├── contexts/       # React contexts
│   └── hooks/         # Custom hooks
├── Dockerfile
├── Dockerfile.dev
└── package.json
```

### Принципы компонентов

- Использование shadcn/ui компонентов
- Поддержка темной темы через CSS-переменные
- Code splitting для оптимизации
- Error Boundary для обработки ошибок
- Skeleton loaders для состояний загрузки
- Empty states для пустых состояний

### Основные роуты

- `/` - Онбординг
- `/auth` - Авторизация
- `/services` - Каталог услуг
- `/services/:id` - Детали услуги
- `/masters` - Выбор мастера
- `/calendar` - Календарь записи
- `/confirm` - Подтверждение записи
- `/profile` - Личный кабинет
- `/history` - История посещений
- `/notifications` - Уведомления
- `/reschedule/:id` - Перенос записи

### Правила сборки/деплоя

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm run preview
```

**Docker:**
```bash
docker-compose -f docker-compose.dev.yml build frontend
docker-compose -f docker-compose.dev.yml up -d frontend
```

## ADMIN PANEL

### Как запускать admin

**Через Docker:**
```bash
docker-compose -f docker-compose.dev.yml up -d admin
docker-compose -f docker-compose.dev.yml logs -f admin
```

**Локально:**
```bash
cd admin
npm install
npm run dev
```

### Структура файлов

```
admin/
├── app/                 # Next.js App Router
│   ├── dashboard/      # Dashboard
│   ├── appointments/   # Управление записями
│   ├── clients/       # Управление клиентами
│   ├── services/      # Управление услугами
│   ├── masters/       # Управление мастерами
│   ├── mailings/      # Рассылки
│   ├── telegram/      # Управление Telegram ботом
│   ├── settings/       # Настройки
│   └── components/    # Компоненты
├── components/         # shadcn/ui компоненты
├── lib/               # Утилиты
├── Dockerfile
├── Dockerfile.dev
└── package.json
```

### Принципы компонентов

- Использование shadcn/ui компонентов
- Поддержка темной темы через CSS-переменные
- Динамические импорты для оптимизации
- React Query для управления данными
- Error Boundary для обработки ошибок

### Основные роуты

- `/login` - Вход в админ-панель
- `/dashboard` - Статистика и аналитика
- `/appointments` - Управление записями
- `/appointments/calendar` - Календарный вид записей
- `/clients` - Управление клиентами
- `/services` - Управление услугами
- `/masters` - Управление мастерами
- `/mailings` - Рассылки
- `/telegram` - Управление Telegram ботом
- `/settings` - Настройки системы
- `/audit` - Журнал действий

### Правила сборки/деплоя

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm run start
```

**Docker:**
```bash
docker-compose -f docker-compose.dev.yml build admin
docker-compose -f docker-compose.dev.yml up -d admin
```

## Docker команды

### Команды для тестирования (docker-compose.dev.yml)

```bash
# Запуск всех сервисов
docker-compose -f docker-compose.dev.yml up -d

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f

# Просмотр логов с правильной кодировкой UTF-8 (для Windows PowerShell)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001
docker-compose -f docker-compose.dev.yml logs backend --tail=100

# Или используйте скрипт view-logs.ps1 (ТОЛЬКО для development):
.\view-logs.ps1 -Pattern "CRON|REMINDER" -Tail 200

# Остановка
docker-compose -f docker-compose.dev.yml down

# Перезапуск сервиса
docker-compose -f docker-compose.dev.yml restart backend

# Выполнение команд в контейнере
docker-compose -f docker-compose.dev.yml exec backend npm run migration:run
```

### Команды для деплоя (docker-compose.yml)

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f backend

# Остановка
docker-compose down

# Перезапуск сервиса
docker-compose restart backend

# Выполнение команд в контейнере
docker-compose exec backend npm run migration:run

# Пересборка и перезапуск
docker-compose up -d --build
```

**Примечание:** В продакшене используйте стандартные команды `docker-compose logs`. Скрипт `view-logs.ps1` предназначен только для локальной разработки на Windows и использует `docker-compose.dev.yml`.

### Когда нужно пересобирать

- Изменения в `Dockerfile.dev` или `docker-compose.dev.yml`
- Изменения в `package.json` (новые зависимости)
- Изменения в системных зависимостях

### Когда изменения применяются автоматически

- Изменения в исходном коде (`.ts`, `.tsx`, `.js`, `.jsx`)
- Изменения в стилях (`.css`, `.scss`)

## Проверка работы

После запуска сервисы доступны:
- **Backend API:** http://localhost:3001/api/docs (Swagger)
- **Frontend:** http://localhost:3000
- **Admin панель:** http://localhost:3002

## Настройка Telegram бота

1. Создайте бота через @BotFather в Telegram
2. Получите токен бота
3. Добавьте токен в `.env` файл: `TELEGRAM_BOT_TOKEN=your-token`
4. Перезапустите backend: `docker-compose -f docker-compose.dev.yml restart backend`

### ⚠️ Решение ошибки 409: Conflict (несколько экземпляров бота)

Если вы видите ошибку:
```
ERROR [TelegramBotService] Ошибка при запуске бота: 409: Conflict: terminated by other getUpdates request
```

**Причины:**
- Запущено несколько контейнеров backend одновременно
- Бот запущен локально И в Docker одновременно
- Старый процесс бота не был корректно остановлен

**Решение:**

1. **Остановите все экземпляры:**
```bash
# Остановка Docker контейнеров
docker-compose -f docker-compose.dev.yml down

# Проверка запущенных процессов локально (если запускали не через Docker)
# Windows PowerShell:
Get-Process node | Where-Object {$_.Path -like "*backend*"}

# Linux/Mac:
ps aux | grep "nest start"
```

2. **Убедитесь, что запущен только один экземпляр:**
   - Либо только Docker: `docker-compose -f docker-compose.dev.yml up -d backend`
   - Либо только локально: `cd backend && npm run start:dev`
   - НЕ запускайте оба одновременно!

3. **Если проблема сохраняется:**
```bash
# Полная очистка и перезапуск
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build backend
```

**Примечание:** Код теперь обрабатывает эту ошибку gracefully - приложение продолжит работу, но бот не будет обрабатывать обновления до устранения конфликта.

## Реализованные функции

### Backend ✅

- Модуль аутентификации (Telegram Login, JWT)
- Ядро бронирования (проверка слотов, расписание)
- Финансовый модуль (бонусная система)
- Уведомления (Telegram Push, шаблоны)
- API и WebSocket (REST API, real-time обновления)
- Автоматизации (Cron задачи)
- Telegram бот (команды, клавиатуры, календарь)
- Управление расписанием мастеров
- История взаимодействий с клиентами
- Настройки системы
- Расширенная аналитика

### Frontend ✅

- Онлайн-запись (полный цикл)
- Личный кабинет (будущие записи, история, бонусы)
- Каталог услуг (список, детали, фильтрация)
- Все необходимые компоненты
- Error Boundary
- Code splitting
- Skeleton loaders
- Empty states
- Offline detection

### Admin Panel ✅

- Dashboard с KPI и графиками
- Управление записями (подтверждение, отмена, удаление)
- Календарный вид записей с drag & drop
- Управление клиентами (CRUD, история взаимодействий)
- Управление услугами (CRUD, привязка мастеров)
- Управление мастерами (CRUD, расписание, блокировки)
- Рассылки (WYSIWYG редактор, история, статистика)
- Управление Telegram ботом (отправка сообщений, управление чатами)
- Настройки системы
- Журнал действий (аудит)
- Темная тема
- Экспорт отчетов

## Статус проекта

**Готовность:** ~99%

### ✅ Готово

1. Все основные модули реализованы
2. Docker конфигурация готова
3. База данных структурирована
4. API документация доступна
5. Frontend и Admin панели работают
6. Telegram бот полностью функционален
7. Поддержка темной темы
8. shadcn/ui интегрирован

### ⚠️ Требует настройки

1. Переменные окружения (.env файл)
2. Telegram Bot Token
3. Настройка PostgreSQL и Redis
4. Заполнение начальных данных (услуги, мастера)
5. Настройка доменов и SSL (для production)

## Контент

Контентные материалы находятся в папке `.md/content/`:
- FAQ (часто задаваемые вопросы)
- Описания услуг
- Биографии мастеров
- Маркетинговые кампании
- Шаблоны уведомлений

## Лицензия

MIT
