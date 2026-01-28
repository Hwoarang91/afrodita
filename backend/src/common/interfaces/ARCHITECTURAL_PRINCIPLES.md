# Архитектурные принципы обработки ошибок

## Ключевые принципы (зафиксировано как правило)

### Строго:

❌ **Никаких `error.message.includes()` вне mapper**

❌ **Никаких Telegram строк в UI / controller**

✅ **Единственная точка знания MTProto — `telegram-error-mapper.ts`**

✅ **UI работает только с `ErrorCode`**

---

## Детальное описание

### 1. Никаких `error.message.includes()` вне mapper

**Правило:**
- Все проверки Telegram ошибок должны быть только в `telegram-error-mapper.ts`
- В контроллерах, сервисах и UI запрещено использовать `error.message.includes('AUTH_KEY_UNREGISTERED')` и подобные проверки

**Правильно:**
```typescript
// ✅ В telegram-error-mapper.ts
if (upperMessage.includes('AUTH_KEY_UNREGISTERED')) {
  return { errorCode: ErrorCode.SESSION_INVALID, ... };
}

// ✅ В контроллере
const errorResponse = mapTelegramErrorToResponse(error);
if (errorResponse.errorCode === ErrorCode.SESSION_INVALID) {
  // обработка
}
```

**Неправильно:**
```typescript
// ❌ В контроллере
if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
  // обработка
}
```

---

### 2. Никаких Telegram строк в UI / controller

**Правило:**
- UI и контроллеры не должны знать о Telegram MTProto ошибках
- Все проверки должны использовать только `ErrorCode` enum

**Правильно:**
```typescript
// ✅ В UI
if (error.errorCode === ErrorCode.SESSION_INVALID) {
  redirectToAuth();
}
```

**Неправильно:**
```typescript
// ❌ В UI
if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
  redirectToAuth();
}
```

---

### 3. Единственная точка знания MTProto — `telegram-error-mapper.ts`

**Правило:**
- Все знания о Telegram MTProto ошибках должны быть изолированы в `telegram-error-mapper.ts`
- Никакой другой файл не должен знать о формате Telegram ошибок

**Структура:**
```
telegram-error-mapper.ts  ← Единственная точка знания MTProto
    ↓
mtproto-error.handler.ts  ← Использует mapper
    ↓
controllers/services      ← Работают с ErrorCode
    ↓
UI                        ← Работает с ErrorCode
```

---

### 4. UI работает только с ErrorCode

**Правило:**
- UI должен использовать только `ErrorCode` enum из `error-response.interface.ts`
- Для определения поведения UI использовать `error-code-ui-matrix.ts`

**Правильно:**
```typescript
// ✅ В UI
import { ErrorCode } from '@shared/error-response';
import { getUIBehaviorForErrorCode } from './error-code-ui-matrix';

const behavior = getUIBehaviorForErrorCode(error.errorCode);
if (behavior) {
  behavior.action(error);
}
```

**Неправильно:**
```typescript
// ❌ В UI
if (error.message === 'AUTH_KEY_UNREGISTERED') {
  // обработка
}
```

---

## Проверка соблюдения принципов

### Автоматические тесты

Запустите тесты для проверки соблюдения принципов:

```bash
npm test -- architectural-principles.spec.ts
```

### Ручная проверка

1. **Поиск нарушений в коде:**
```bash
# Ищем includes() для Telegram ошибок вне mapper
grep -r "includes.*AUTH_KEY" backend/src --exclude="*mapper*"
grep -r "includes.*SESSION_" backend/src --exclude="*mapper*"
grep -r "includes.*PHONE_" backend/src --exclude="*mapper*"
```

2. **Проверка UI:**
```bash
# Ищем Telegram строки в UI
grep -r "AUTH_KEY_UNREGISTERED" admin/
grep -r "SESSION_REVOKED" admin/
```

---

## Примеры правильной архитектуры

### Backend: Обработка Telegram ошибки

```typescript
// ✅ Правильно
try {
  await client.invoke({ _: 'auth.signIn', ... });
} catch (error) {
  const errorResponse = mapTelegramErrorToResponse(error);
  
  if (errorResponse.errorCode === ErrorCode.SESSION_INVALID) {
    await invalidateSession(sessionId);
  }
  
  throw new HttpException(errorResponse, errorResponse.statusCode);
}
```

### Frontend: Обработка ошибки

```typescript
// ✅ Правильно
try {
  await api.post('/auth/telegram/phone/verify', data);
} catch (error) {
  const { errorCode, message, retryAfter } = error.response.data;
  
  const behavior = getUIBehaviorForErrorCode(errorCode);
  if (behavior) {
    behavior.action({ errorCode, message, retryAfter });
  } else {
    toast.error(message);
  }
}
```

---

## Нарушения принципов

Если вы видите код, который нарушает эти принципы:

1. **Вынесите проверку в `telegram-error-mapper.ts`**
2. **Используйте `ErrorCode` вместо строк**
3. **Обновите `error-code-ui-matrix.ts` для UI поведения**

---

## Связанные файлы

- `backend/src/modules/telegram-user-api/utils/telegram-error-mapper.ts` - единственная точка знания MTProto («от своего лица»)
- `backend/src/common/interfaces/error-response.interface.ts` - ErrorCode enum
- `admin/lib/error-code-ui-matrix.ts` - UI поведение для ErrorCode
- `backend/src/common/utils/error-code-http-map.ts` - маппинг ErrorCode → HTTP status

