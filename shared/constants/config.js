"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_ROLES = exports.APPOINTMENT_STATUS = exports.DATE_FORMATS = exports.PAGINATION = exports.API_CONFIG = void 0;
exports.API_CONFIG = {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
exports.DATE_FORMATS = {
    DISPLAY: 'dd.MM.yyyy',
    DISPLAY_WITH_TIME: 'dd.MM.yyyy HH:mm',
    API: 'yyyy-MM-dd',
    API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss",
};
exports.APPOINTMENT_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    RESCHEDULED: 'rescheduled',
};
exports.USER_ROLES = {
    CLIENT: 'client',
    ADMIN: 'admin',
    MASTER: 'master',
};
//# sourceMappingURL=config.js.map