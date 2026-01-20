## Отчет о покрытии тестами

### Общее покрытие кода

**Дата проверки:** 19.01.2026

**Общие показатели:**
- **Statements (Инструкции):** 51.23% (2691/5252)
- **Branches (Ветвления):** 37.79% (658/1741)
- **Functions (Функции):** 56.36% (385/683)
- **Lines (Строки):** 50.82% (2548/5013)

### Покрытие по модулям

#### Модули с высоким покрытием (>80%)
- `src/common/cache` - 100%
- `src/common/decorators` - 100%
- `src/common/guards` - 100%
- `src/common/middleware` - 100%
- `src/modules/users` - 86.59%
- `src/modules/analytics` - 88.04%
- `src/modules/appointments` - 88.35%
- `src/modules/audit` - 86.11%

#### Модулы с низким покрытием (<50%)
- `src/config` - 0%
- `src/migrations` - 0%
- `src/modules/auth` - 0% (но есть тесты для отдельных компонентов)
- `src/modules/auth/dto` - 0%

### Проблемные области

1. **ReferralService** - отсутствуют тесты
   - Файл: `backend/src/modules/users/referral.service.ts`
   - Критический сервис для реферальной системы
   - Рекомендуется добавить тесты для всех методов

2. **Модуль auth** - низкое покрытие
   - Основной модуль аутентификации
   - Требуется дополнительное покрытие тестами

3. **Config и migrations** - 0% покрытия
   - Это нормально, так как это конфигурационные файлы и миграции
   - Не требуют тестирования

### Статистика тестов

- Всего тестовых файлов: 54 (`.spec.ts`)
- Тестовых файлов для users модуля: 2
  - `users.service.spec.ts`
  - `users.controller.spec.ts`

### Рекомендации

1. ✅ Добавить тесты для `ReferralService`
   - `generateReferralCode()`
   - `getOrGenerateReferralCode()`
   - `getUserByReferralCode()`
   - `processReferralRegistration()`
   - `getReferralStats()`

2. ✅ Улучшить покрытие модуля auth
   - Критически важный модуль для безопасности

3. ✅ Добавить интеграционные тесты для реферальной системы
   - Проверка полного цикла регистрации по реферальному коду
   - Проверка начисления бонусов

### Команды для запуска тестов

```bash
# Запуск всех тестов
npm run test

# Запуск тестов с покрытием
npm run test:cov

# Запуск тестов в watch режиме
npm run test:watch

# Запуск e2e тестов
npm run test:e2e
```
