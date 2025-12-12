// Типы для ошибок API
export interface ApiError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
    statusText?: string;
  };
}

// Тип для ошибок axios
export interface AxiosError extends Error {
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
    statusText?: string;
  };
  config?: {
    url?: string;
  };
}

// Утилита для извлечения сообщения об ошибке
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError;
    return apiError.response?.data?.message || apiError.message || 'Произошла ошибка';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Произошла неизвестная ошибка';
}

// Утилита для проверки статуса ошибки
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError;
    return apiError.response?.status;
  }
  return undefined;
}

