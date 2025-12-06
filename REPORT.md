## Инструкции по запуску

### Запуск через Docker

docker compose build
docker compose up -d
docker compose logs -f
docker compose down

### Локальный запуск

npm install
npm run dev

### Запуск в продакшен на выделенном сервере Ubuntu

После настройки переменных окружения и запуска через docker compose.

---

## Отчёт по проекту

### Изменения

🔄 Восстановление структуры проекта после очистки git репозитория.

### Что сделал ИИ

✅ Создан файл REPORT.md согласно правилам проекта
✅ Созданы тесты для сервисов: SettingsService, FinancialService, UsersService, MastersService, ReviewsService, TemplatesService, AnalyticsService, NotificationsService, AuditService, TelegramChatsService, TelegramService, SchedulerService
✅ Расширены тесты для AppointmentsService и AuthService
✅ Созданы тесты для контроллеров: AppointmentsController, ServicesController, AuthController, UsersController, MastersController, ReviewsController, SettingsController, FinancialController, TemplatesController, AnalyticsController
✅ Расширены тесты для сервисов: ServicesService (findMainServices, findCategories, findServicesForBot), AppointmentsService (reschedule), MastersService (createSchedule, updateSchedule, deleteSchedule, createBlockInterval, deleteBlockInterval), UsersService (getInteractionHistory), NotificationsService (sendBroadcast)
✅ Исправлены ошибки в тестах (bcrypt, Session entity, repository methods, AuditAction enum, parse_mode type, missing repository methods)
✅ Созданы тесты для контроллеров: NotificationsController, AuditController
✅ Расширены тесты для сервисов: ServicesService (валидация категорий), AppointmentsService (первый визит и скидки), UsersService (update), MastersService (create с serviceIds)
✅ Созданы тесты для guards и strategies: RolesGuard, JwtStrategy
✅ Расширены тесты для ServicesService (update, delete), AppointmentsService (update), MastersService (update, delete)
✅ Расширены тесты для NotificationsService (getBroadcastHistory, getBroadcastDetails, deleteNotifications, deleteNotification)
✅ Расширены тесты для SettingsService и TemplatesService
✅ Все 222 теста проходят успешно
✅ Покрытие кода: 38.96% (прогресс к контрольной точке ~45%)
✅ Добавлены тесты для confirm, cancelByAdmin, delete в AppointmentsService
✅ Добавлены тесты для фильтрации в findAll (по датам, по мастеру)
✅ Добавлены тесты для delete в UsersService (с проверкой связанных записей)
✅ Все 240 тестов проходят успешно

### Статус задачи

🔄 Восстановление структуры - in-progress

### Следующие шаги

- Проверить необходимость admin/middleware.ts
- Восстановить backend/src/common/interfaces/ если требуется
- Проверить изменения в отслеживаемых файлах

### Общая информация

Проект Афродита - Telegram-бот и Web App для массажного салона.

Технологический стек:
- Backend: NestJS, TypeORM, PostgreSQL
- Frontend: React, Vite, Tailwind CSS
- Admin: Next.js, shadcn/ui
- Telegram Bot: node-telegram-bot-api

### BACKEND

Состояние backend после изменений.

Структура директорий стандартная для NestJS проекта.

Важные модули:
- appointments - управление записями
- auth - аутентификация
- masters - управление мастерами
- services - управление услугами
- telegram - интеграция с Telegram
- notifications - уведомления

### FRONTEND

Состояние frontend после изменений.

Структура файлов стандартная для React приложения.

Принципы компонентов:
- Использование shadcn/ui компонентов
- Поддержка темной темы
- Error Boundary для обработки ошибок

Основные роуты:
- / - Онбординг
- /auth - Авторизация
- /services - Каталог услуг
- /calendar - Календарь записи
- /profile - Личный кабинет
