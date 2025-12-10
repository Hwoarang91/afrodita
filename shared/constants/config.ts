// Общие константы конфигурации

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 секунд
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 секунда
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'dd.MM.yyyy',
  DISPLAY_WITH_TIME: 'dd.MM.yyyy HH:mm',
  API: 'yyyy-MM-dd',
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
} as const;

export const USER_ROLES = {
  CLIENT: 'client',
  ADMIN: 'admin',
  MASTER: 'master',
} as const;

