export declare const API_CONFIG: {
    readonly TIMEOUT: 30000;
    readonly RETRY_ATTEMPTS: 3;
    readonly RETRY_DELAY: 1000;
};
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
export declare const DATE_FORMATS: {
    readonly DISPLAY: "dd.MM.yyyy";
    readonly DISPLAY_WITH_TIME: "dd.MM.yyyy HH:mm";
    readonly API: "yyyy-MM-dd";
    readonly API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss";
};
export declare const APPOINTMENT_STATUS: {
    readonly PENDING: "pending";
    readonly CONFIRMED: "confirmed";
    readonly COMPLETED: "completed";
    readonly CANCELLED: "cancelled";
    readonly RESCHEDULED: "rescheduled";
};
export declare const USER_ROLES: {
    readonly CLIENT: "client";
    readonly ADMIN: "admin";
    readonly MASTER: "master";
};
