# ADR-003: Error Handling Strategy

**Статус:** ✅ Принято  
**Дата:** 2025-12-23  
**Авторы:** Development Team  
**Контекст:** Необходимо обеспечить единообразную обработку ошибок во всем приложении (backend, frontend, API) с гарантией консистентности и предсказуемости.

---

## Проблема

### До введения единой стратегии

1. **Разные форматы ошибок:**
   ```typescript
   // Backend возвращал:
   { error: 'Validation failed' }
   { message: ['Field is required'] }
   { errors: [{ field: 'phone', message: 'invalid' }] }
   ```

2. **Нет единого контракта:**
   ```typescript
   // UI пытался обработать по-разному
   if (error.message) { ... }
   if (error.errors) { ... }
   if (Array.isArray(error.message)) { ... }
   ```

3. **Проблемы:**
   - React error #31 при попытке отрендерить объект
   - Невозможность программной обработки ошибок
   - Сложность тестирования
   - Разные HTTP статусы для одинаковых ошибок

---

## Решение

### 1. ErrorResponse contract

**Правило:** Все ошибки API возвращаются в едином формате `ErrorResponse`.

**Структура:**
```typescript
interface ErrorResponse {
  success: false;                    // Всегда false для ошибок
  statusCode: number;                // HTTP статус код
  errorCode: ErrorCode | string;     // Machine-readable код
  message: string;                    // Human-readable сообщение (всегда строка!)
  details?: ErrorDetail[];            // Опциональные детали
  retryAfter?: number;                // Для rate limiting (секунды)
}
```

**Почему единый контракт:**

1. **Предсказуемость:**
   ```typescript
   // ✅ UI всегда знает структуру
   const { errorCode, message, retryAfter } = error.response.data;
   ```

2. **Type-safe:**
   ```typescript
   // ✅ TypeScript проверяет на этапе компиляции
   if (error.errorCode === ErrorCode.FLOOD_WAIT) {
     showTimer(error.retryAfter); // ← TypeScript знает про retryAfter
   }
   ```

3. **Независимость от источника ошибки:**
   ```typescript
   // ✅ Одинаковая обработка для всех ошибок
   // Validation, Telegram, Database, Network
   const errorResponse = buildErrorResponse(...);
   ```

---

### 2. Глобальные фильтры

**Правило:** Все HTTP исключения обрабатываются глобальными фильтрами.

**Архитектура:**
```
Exception
    ↓
ValidationExceptionFilter (BadRequestException)
    ↓
HttpExceptionFilter (HttpException)
    ↓
AllExceptionsFilter (все остальное)
    ↓
ErrorResponse (единый формат)
```

**Порядок регистрации:**
```typescript
// main.ts
app.useGlobalFilters(
  new ValidationExceptionFilter(), // 1. Обрабатывает ValidationPipe
  new HttpExceptionFilter(),       // 2. Обрабатывает все HttpException
  new AllExceptionsFilter(),       // 3. Обрабатывает все остальное
);
```

**Почему глобальные фильтры:**

1. **Централизация:**
   - Вся логика обработки ошибок в одном месте
   - Легко изменить формат ответа для всех ошибок

2. **Гарантия консистентности:**
   - Невозможно случайно вернуть ошибку в другом формате
   - Все ошибки проходят через один и тот же pipeline

3. **Логирование и метрики:**
   ```typescript
   // ✅ Все ошибки логируются и учитываются
   this.errorMetricsService.recordError(errorCode, context);
   ```

---

### 3. UI behavior matrix

**Правило:** UI поведение определяется по `ErrorCode`, не по сообщению.

**Реализация:**
```typescript
// error-code-ui-matrix.ts
export const ERROR_CODE_UI_MATRIX: Record<ErrorCode, UIBehavior> = {
  [ErrorCode.FLOOD_WAIT]: {
    message: 'Слишком много запросов. Пожалуйста, подождите.',
    action: 'show_timer',
    canRetry: false,
  },
  [ErrorCode.SESSION_INVALID]: {
    message: 'Ваша Telegram сессия недействительна...',
    action: 'redirect_to_auth',
    redirectPath: '/telegram/auth',
    requiresReauth: true,
  },
  // ...
};
```

**Почему UI behavior matrix:**

1. **Централизация UI логики:**
   ```typescript
   // ✅ Одно место для всех UI поведений
   const behavior = getUIBehaviorForErrorCode(error.errorCode);
   behavior.action(error);
   ```

2. **Независимость от backend:**
   - Backend может изменить сообщение, UI поведение не изменится
   - Легко добавить новое поведение для существующего ErrorCode

3. **Тестируемость:**
   ```typescript
   // ✅ Легко тестировать UI поведение
   expect(getUIBehaviorForErrorCode(ErrorCode.FLOOD_WAIT).action)
     .toBe('show_timer');
   ```

---

## Последствия

### Положительные

1. ✅ Единообразная обработка ошибок во всем приложении
2. ✅ Предсказуемое поведение UI
3. ✅ Легко тестировать (мокировать ErrorResponse)
4. ✅ Type-safe код
5. ✅ Централизованное логирование и метрики

### Отрицательные

1. ⚠️ Требуется обновление фильтров при новых типах ошибок
2. ⚠️ Дополнительный слой абстракции

---

## Проверка соблюдения

### Автоматические тесты

```typescript
// error-response.contract.test.ts
it('должен возвращать ErrorResponse с правильной структурой', () => {
  const response = buildErrorResponse(...);
  expect(validateErrorResponse(response)).toBe(true);
});
```

### Ручная проверка

```bash
# Ищем прямые throw new HttpException без ErrorResponse
grep -r "throw new HttpException" backend/src
```

---

## Связанные документы

- `error-response.interface.ts` - ErrorResponse contract
- `error-response.builder.ts` - helper функции
- `http-exception.filter.ts` - глобальный фильтр
- `error-code-ui-matrix.ts` - UI поведение

---

## История изменений

- **2025-12-23:** Создан ADR-003

