# ErrorResponse Contract

## Назначение

Единый контракт для всех ошибок API, гарантирующий, что UI всегда получает строку в `message`, а не объект или массив. Это предотвращает React error #31 и подобные баги.

## Базовый формат

```typescript
interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;          // MACHINE-READABLE код ошибки
  message: string;            // HUMAN-READABLE сообщение (ВСЕГДА строка!)
  details?: ErrorDetail[];    // Опциональные детали (для валидации)
  retryAfter?: number;        // Для rate limiting (секунды)
}

interface ErrorDetail {
  field: string;
  message: string;
}
```

## Примеры ошибок

### ❌ Ошибка валидации DTO (400)

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "message": "Некорректные данные: property userId should not exist",
  "details": [
    {
      "field": "userId",
      "message": "property userId should not exist"
    }
  ]
}
```

### ❌ Неверный пароль 2FA (401)

```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "INVALID_2FA_PASSWORD",
  "message": "Неверный пароль двухфакторной аутентификации"
}
```

### ❌ Сессия устарела (401)

```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "SESSION_INVALID",
  "message": "Telegram сессия недействительна. Требуется повторная авторизация."
}
```

### ❌ Flood wait (429)

```json
{
  "success": false,
  "statusCode": 429,
  "errorCode": "FLOOD_WAIT",
  "message": "Слишком много попыток. Повторите через 42 секунды.",
  "retryAfter": 42
}
```

## Коды ошибок (ErrorCode enum)

- `VALIDATION_ERROR` - Ошибка валидации DTO
- `UNAUTHORIZED` - Не авторизован
- `INVALID_CREDENTIALS` - Неверные учетные данные
- `INVALID_2FA_PASSWORD` - Неверный пароль 2FA
- `SESSION_INVALID` - Сессия недействительна
- `SESSION_NOT_FOUND` - Сессия не найдена
- `PASSWORD_HASH_INVALID` - Неверный password hash
- `NOT_FOUND` - Ресурс не найден
- `FLOOD_WAIT` - Rate limiting (Telegram)
- `TOO_MANY_REQUESTS` - Слишком много запросов
- `INTERNAL_SERVER_ERROR` - Внутренняя ошибка сервера
- `PHONE_CODE_EXPIRED` - Код подтверждения истек
- `PHONE_CODE_INVALID` - Неверный код подтверждения
- `PHONE_NUMBER_INVALID` - Неверный номер телефона
- `PHONE_NUMBER_BANNED` - Номер телефона заблокирован

## Использование на Backend

### Создание ошибки валидации

```typescript
import { buildValidationErrorResponse } from '../common/utils/error-response.builder';

// ValidationExceptionFilter автоматически преобразует ValidationError[]
// в стандартизированный ErrorResponse через buildValidationErrorResponse()
```

### Создание кастомной ошибки

```typescript
import { buildErrorResponse, ErrorCode } from '../common/utils/error-response.builder';

throw new BadRequestException(
  buildErrorResponse(
    400,
    ErrorCode.INVALID_2FA_PASSWORD,
    'Неверный пароль двухфакторной аутентификации'
  )
);
```

## Использование на Frontend

### Извлечение сообщения об ошибке

```typescript
function extractErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) return 'Неизвестная ошибка';

  // Новый стандартизированный формат
  if (data.message && typeof data.message === 'string') {
    return data.message;
  }

  // Fallback для старых форматов
  // ...
}
```

### Отображение ошибки

```typescript
const errorMessage = extractErrorMessage(error);
toast.error(errorMessage);
```

## Что ЗАПРЕЩЕНО возвращать

- ❌ `message` как объект
- ❌ `message` как массив объектов
- ❌ `constraints` напрямую
- ❌ `class-validator ValidationError` целиком
- ❌ Разные форматы ошибок в разных эндпоинтах

## Гарантии

1. **`message` всегда строка** - никогда не объект или массив
2. **Единый формат** - все ошибки следуют одному контракту
3. **Machine-readable `errorCode`** - для программной обработки
4. **Human-readable `message`** - для отображения пользователю
5. **Опциональные `details`** - для детальной информации о валидации

