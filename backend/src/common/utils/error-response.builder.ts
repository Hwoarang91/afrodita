import { ErrorResponse, ErrorDetail, ErrorCode } from '../interfaces/error-response.interface';

/**
 * Helper функция для построения стандартизированного ErrorResponse
 * Гарантирует единообразный формат всех ошибок API
 * 
 * @param statusCode HTTP статус код
 * @param errorCode Machine-readable код ошибки
 * @param message Human-readable сообщение (ВСЕГДА строка)
 * @param details Опциональные детали ошибки
 * @param retryAfter Опциональное время ожидания для rate limiting
 * @returns Стандартизированный ErrorResponse
 */
export function buildErrorResponse(
  statusCode: number,
  errorCode: ErrorCode | string,
  message: string,
  details?: ErrorDetail[],
  retryAfter?: number,
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    statusCode,
    errorCode,
    message, // КРИТИЧНО: всегда строка
  };

  if (details && details.length > 0) {
    response.details = details;
  }

  if (retryAfter !== undefined) {
    response.retryAfter = retryAfter;
  }

  return response;
}

/**
 * Строит ErrorResponse для ошибок валидации
 * Преобразует ValidationError[] в ErrorDetail[]
 */
export function buildValidationErrorResponse(
  validationErrors: Array<{
    property: string;
    constraints?: Record<string, string>;
    value?: any;
  }>,
): ErrorResponse {
  const details: ErrorDetail[] = validationErrors.map((err) => {
    let message = `${err.property}: invalid value`;
    
    if (err.constraints) {
      const constraintMessages = Object.values(err.constraints);
      message = constraintMessages.length > 0 
        ? constraintMessages.join(', ')
        : message;
    }

    return {
      field: err.property,
      message,
    };
  });

  // Формируем общее сообщение из деталей
  const generalMessage = details.length === 1
    ? details[0].message
    : `Некорректные данные: ${details.map(d => d.message).join('; ')}`;

  return buildErrorResponse(
    400,
    ErrorCode.VALIDATION_ERROR,
    generalMessage,
    details,
  );
}

