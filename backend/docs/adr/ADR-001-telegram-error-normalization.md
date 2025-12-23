# ADR-001: Telegram Error Normalization

**Статус:** ✅ Принято  
**Дата:** 2025-12-23  
**Авторы:** Development Team  
**Контекст:** Telegram MTProto API возвращает ошибки в виде строк (например, `AUTH_KEY_UNREGISTERED`, `FLOOD_WAIT_42`). Необходимо нормализовать эти ошибки для единообразной обработки в UI и backend.

---

## Проблема

### До нормализации

1. **Разные форматы ошибок:**
   ```typescript
   // Backend возвращал:
   { message: 'AUTH_KEY_UNREGISTERED' }
   { message: ['Validation error', 'Phone code invalid'] }
   { error: 'FLOOD_WAIT_42' }
   ```

2. **String.includes() везде:**
   ```typescript
   // ❌ В контроллере
   if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
     // обработка
   }
   
   // ❌ В UI
   if (error.message.includes('FLOOD_WAIT')) {
     showTimer();
   }
   ```

3. **Проблемы:**
   - React error #31 при попытке отрендерить массив как JSX
   - Невозможность программной обработки ошибок
   - Дублирование логики маппинга в разных местах
   - Сложность тестирования

---

## Решение

### 1. Единственная точка знания MTProto — `telegram-error-mapper.ts`

**Правило:** Все знания о Telegram MTProto ошибках изолированы в одном файле.

```typescript
// ✅ Единственное место маппинга
export function mapTelegramError(error: any): TelegramErrorMapping {
  const message = error?.errorMessage || error?.message || String(error || '').trim();
  const upperMessage = message.toUpperCase();
  
  // Все проверки здесь
  if (upperMessage.includes('AUTH_KEY_UNREGISTERED')) {
    return {
      errorCode: ErrorCode.SESSION_INVALID,
      statusCode: 401,
      message: 'Ваша Telegram сессия недействительна...',
    };
  }
  // ...
}
```

**Почему:**
- Изменения в формате Telegram ошибок требуют правки только одного файла
- Легко тестировать все возможные ошибки
- Невозможно случайно забыть обработать новую ошибку

---

### 2. Запрет `string.includes()` вне mapper

**Правило:** ❌ Никаких `error.message.includes('AUTH_KEY_UNREGISTERED')` вне `telegram-error-mapper.ts`.

**Почему запрещены string.includes:**

1. **Хрупкость:**
   ```typescript
   // ❌ Сломается, если Telegram изменит формат
   if (error.message.includes('AUTH_KEY')) {
     // Не поймает 'AUTH_KEY_DUPLICATED' или 'AUTH_KEY_INVALID'
   }
   ```

2. **Дублирование логики:**
   ```typescript
   // ❌ Одна и та же проверка в 10 местах
   if (error.message.includes('FLOOD_WAIT')) { ... } // controller
   if (error.message.includes('FLOOD_WAIT')) { ... } // service
   if (error.message.includes('FLOOD_WAIT')) { ... } // UI
   ```

3. **Невозможность тестирования:**
   - Нельзя проверить все возможные варианты ошибок
   - Сложно мокировать для тестов

**Правильно:**
```typescript
// ✅ В контроллере
const errorResponse = mapTelegramErrorToResponse(error);
if (errorResponse.errorCode === ErrorCode.SESSION_INVALID) {
  await invalidateSession(sessionId);
}
```

---

### 3. ErrorCode — единственный контракт

**Правило:** UI и backend работают только с `ErrorCode` enum, никогда со строками Telegram.

**Почему ErrorCode — единственный контракт:**

1. **Machine-readable:**
   ```typescript
   // ✅ Программная обработка
   switch (error.errorCode) {
     case ErrorCode.FLOOD_WAIT:
       showTimer(error.retryAfter);
       break;
     case ErrorCode.SESSION_INVALID:
       redirectToAuth();
       break;
   }
   ```

2. **Type-safe:**
   ```typescript
   // ✅ TypeScript проверяет на этапе компиляции
   if (error.errorCode === ErrorCode.PHONE_CODE_INVALID) {
     // TypeScript знает все возможные значения
   }
   ```

3. **Централизованное управление:**
   ```typescript
   // ✅ Одно место для всех кодов
   export enum ErrorCode {
     FLOOD_WAIT = 'FLOOD_WAIT',
     SESSION_INVALID = 'SESSION_INVALID',
     // ...
   }
   ```

4. **Независимость от Telegram:**
   - Если Telegram изменит формат ошибок, меняется только mapper
   - UI и бизнес-логика остаются неизменными

---

### 4. Message всегда string

**Правило:** `ErrorResponse.message` всегда строка, никогда массив или объект.

**Почему message всегда string:**

1. **UI совместимость:**
   ```typescript
   // ❌ React error #31
   toast.error(error.message); // если message = [{ field: 'phone', message: 'invalid' }]
   
   // ✅ Всегда работает
   toast.error(error.message); // message = 'Неверный номер телефона'
   ```

2. **Консистентность:**
   ```typescript
   // ✅ Всегда один формат
   interface ErrorResponse {
     success: false;
     errorCode: ErrorCode;
     message: string; // ← всегда строка
   }
   ```

3. **Простота логирования:**
   ```typescript
   // ✅ Можно логировать без преобразований
   logger.error(`Error: ${error.message}`);
   ```

**Реализация:**
```typescript
// ✅ ValidationExceptionFilter преобразует массив в строку
const message = validationErrors
  .map(err => `${err.property}: ${Object.values(err.constraints).join(', ')}`)
  .join('; ');
```

---

## Последствия

### Положительные

1. ✅ Единообразная обработка ошибок во всем приложении
2. ✅ Легко тестировать (мокировать ErrorCode вместо строк)
3. ✅ Type-safe код (TypeScript проверяет ErrorCode)
4. ✅ Независимость от изменений Telegram API
5. ✅ Невозможность случайно забыть обработать ошибку

### Отрицательные

1. ⚠️ Требуется обновление mapper при новых ошибках Telegram
2. ⚠️ Дополнительный слой абстракции (небольшой overhead)

---

## Проверка соблюдения

### Автоматические тесты

```typescript
// architectural-principles.spec.ts
it('не должно быть includes() для Telegram ошибок в контроллерах', () => {
  // Проверка кода
});
```

### Ручная проверка

```bash
# Ищем нарушения
grep -r "includes.*AUTH_KEY" backend/src --exclude="*mapper*"
grep -r "includes.*SESSION_" backend/src --exclude="*mapper*"
```

---

## Связанные документы

- `ARCHITECTURAL_PRINCIPLES.md` - детальное описание принципов
- `telegram-error-mapper.ts` - реализация маппинга
- `error-response.interface.ts` - ErrorCode enum и ErrorResponse contract

---

## История изменений

- **2025-12-23:** Создан ADR-001

