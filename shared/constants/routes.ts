// Общие константы для маршрутов

export const APP_ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  SERVICES: '/services',
  SERVICE_DETAIL: '/services/:id',
  MASTER_SELECTION: '/masters',
  CALENDAR: '/calendar',
  CONFIRM: '/confirm',
  PROFILE: '/profile',
  HISTORY: '/history',
  NOTIFICATIONS: '/notifications',
  RESCHEDULE: '/reschedule/:id',
  NOT_FOUND: '*',
} as const;

export const ADMIN_ROUTES = {
  LOGIN: '/admin/login',
  REGISTER: '/admin/register',
  DASHBOARD: '/admin/dashboard',
  APPOINTMENTS: '/admin/appointments',
  APPOINTMENTS_CALENDAR: '/admin/appointments/calendar',
  CLIENTS: '/admin/clients',
  CLIENT_DETAIL: '/admin/clients/:id',
  MASTERS: '/admin/masters',
  MASTER_SCHEDULE: '/admin/masters/:id/schedule',
  SERVICES: '/admin/services',
  TEMPLATES: '/admin/templates',
  TELEGRAM: '/admin/telegram',
  TELEGRAM_USER: '/admin/telegram-user',
  MAILINGS: '/admin/mailings',
  SETTINGS: '/admin/settings',
  AUDIT: '/admin/audit',
} as const;

export const API_ROUTES = {
  BASE: '/api/v1',
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    CHECK_SETUP: '/auth/check-setup',
    VALIDATE_TELEGRAM: '/auth/validate-telegram',
  },
  APPOINTMENTS: {
    BASE: '/appointments',
    CONFIRM: '/appointments/:id/confirm',
    CANCEL: '/appointments/:id/cancel',
    RESCHEDULE: '/appointments/:id/reschedule',
  },
  SERVICES: {
    BASE: '/services',
    CATEGORIES: '/services/categories',
    SUBCATEGORIES: '/services/subcategories',
  },
  MASTERS: {
    BASE: '/masters',
    SCHEDULE: '/masters/:id/schedule',
  },
  USERS: {
    BASE: '/users',
    PROFILE: '/users/profile',
  },
  NOTIFICATIONS: {
    BASE: '/notifications',
    MARK_READ: '/notifications/:id/read',
  },
} as const;

