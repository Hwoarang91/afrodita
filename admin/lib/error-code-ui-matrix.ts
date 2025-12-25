/**
 * UI матрица ErrorCode → UI behavior
 * 
 * Определяет единое поведение UI для каждого типа ошибки
 * Упрощает UI код, убирает if-else хаос, даёт единое поведение
 * 
 * Использование:
 * ```typescript
 * const behavior = ERROR_CODE_UI_MATRIX[error.errorCode];
 * if (behavior) {
 *   behavior.action(error);
 * }
 * ```
 */

// Используем строковые литералы вместо enum, так как ErrorCode определен в backend
// и не доступен напрямую из admin приложения
type ErrorCode = string;

export type UIBehaviorAction = (error: {
  errorCode: string;
  message: string;
  retryAfter?: number;
}) => void;

export interface ErrorCodeUIBehavior {
  /**
   * Действие для UI (например, показать таймер, shake input, redirect)
   */
  action: UIBehaviorAction;
  
  /**
   * Описание поведения для документации
   */
  description: string;
  
  /**
   * Можно ли повторить запрос автоматически
   */
  autoRetry?: boolean;
  
  /**
   * Требуется ли перелогин
   */
  requiresReauth?: boolean;
}

/**
 * Матрица соответствия ErrorCode и UI поведения
 */
export const ERROR_CODE_UI_MATRIX: Partial<Record<ErrorCode | string, ErrorCodeUIBehavior>> = {
  // Rate limiting
  [ErrorCode.FLOOD_WAIT]: {
    description: 'Показать таймер обратного отсчета',
    action: (error) => {
      // Пример: showFloodTimer(error.retryAfter)
      console.log(`[UI] FLOOD_WAIT: показать таймер на ${error.retryAfter} секунд`);
    },
    autoRetry: true,
  },
  
  TOO_MANY_REQUESTS: {
    description: 'Показать сообщение о превышении лимита',
    action: (error) => {
      // Пример: toast.error(error.message)
      console.log(`[UI] TOO_MANY_REQUESTS: ${error.message}`);
    },
  },

  // Phone code errors
  PHONE_CODE_INVALID: {
    description: 'Показать ошибку в поле ввода кода, shake input',
    action: (error) => {
      // Пример: setCodeError(error.message); shakeInput('code')
      console.log(`[UI] PHONE_CODE_INVALID: shake input, показать ошибку`);
    },
  },
  
  PHONE_CODE_EXPIRED: {
    description: 'Показать кнопку "Запросить код заново"',
    action: (error) => {
      // Пример: showRequestNewCodeButton()
      console.log(`[UI] PHONE_CODE_EXPIRED: показать кнопку запроса нового кода`);
    },
  },
  
  PHONE_NUMBER_INVALID: {
    description: 'Показать ошибку в поле номера телефона',
    action: (error) => {
      // Пример: setPhoneError(error.message)
      console.log(`[UI] PHONE_NUMBER_INVALID: показать ошибку в поле телефона`);
    },
  },
  
  PHONE_NUMBER_BANNED: {
    description: 'Показать блокирующее сообщение с ссылкой на поддержку',
    action: (error) => {
      // Пример: showBlockedMessage(error.message, supportLink)
      console.log(`[UI] PHONE_NUMBER_BANNED: показать блокирующее сообщение`);
    },
  },

  // 2FA errors
  INVALID_2FA_PASSWORD: {
    description: 'Shake input пароля, показать ошибку',
    action: (error) => {
      // Пример: shakeInput('password'); setPasswordError(error.message)
      console.log(`[UI] INVALID_2FA_PASSWORD: shake input, показать ошибку`);
    },
  },

  // Session errors
  SESSION_INVALID: {
    description: 'Перенаправить на страницу авторизации',
    action: (error) => {
      // Пример: router.push('/auth/telegram')
      console.log(`[UI] SESSION_INVALID: перенаправить на авторизацию`);
    },
    requiresReauth: true,
  },
  
  SESSION_NOT_FOUND: {
    description: 'Перенаправить на страницу авторизации',
    action: (error) => {
      // Пример: router.push('/auth/telegram')
      console.log(`[UI] SESSION_NOT_FOUND: перенаправить на авторизацию`);
    },
    requiresReauth: true,
  },

  // Migration errors
  DC_MIGRATE: {
    description: 'Автоматически повторить запрос',
    action: (error) => {
      // Пример: retryRequest()
      console.log(`[UI] DC_MIGRATE: автоматически повторить запрос`);
    },
    autoRetry: true,
  },
  
  RETRY: {
    description: 'Автоматически повторить запрос',
    action: (error) => {
      // Пример: retryRequest()
      console.log(`[UI] RETRY: автоматически повторить запрос`);
    },
    autoRetry: true,
  },
  
  TIMEOUT: {
    description: 'Показать сообщение и предложить повторить',
    action: (error) => {
      // Пример: toast.error(error.message); showRetryButton()
      console.log(`[UI] TIMEOUT: показать сообщение, предложить повторить`);
    },
    autoRetry: true,
  },

  // Validation errors
  VALIDATION_ERROR: {
    description: 'Показать ошибки валидации в соответствующих полях',
    action: (error) => {
      // Пример: showValidationErrors(error.details)
      console.log(`[UI] VALIDATION_ERROR: показать ошибки валидации`);
    },
  },
};

/**
 * Получает UI поведение для ErrorCode
 * 
 * @param errorCode - Код ошибки
 * @returns UI поведение или null если не найдено
 */
export function getUIBehaviorForErrorCode(
  errorCode: string,
): ErrorCodeUIBehavior | null {
  return ERROR_CODE_UI_MATRIX[errorCode] || null;
}

/**
 * Проверяет, требуется ли перелогин для ошибки
 * 
 * @param errorCode - Код ошибки
 * @returns true если требуется перелогин
 */
export function requiresReauth(errorCode: string): boolean {
  const behavior = getUIBehaviorForErrorCode(errorCode);
  return behavior?.requiresReauth ?? false;
}

/**
 * Проверяет, можно ли автоматически повторить запрос
 * 
 * @param errorCode - Код ошибки
 * @returns true если можно автоматически повторить
 */
export function canAutoRetry(errorCode: string): boolean {
  const behavior = getUIBehaviorForErrorCode(errorCode);
  return behavior?.autoRetry ?? false;
}

