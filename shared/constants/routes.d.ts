export declare const APP_ROUTES: {
    readonly HOME: "/";
    readonly AUTH: "/auth";
    readonly SERVICES: "/services";
    readonly SERVICE_DETAIL: "/services/:id";
    readonly MASTER_SELECTION: "/masters";
    readonly CALENDAR: "/calendar";
    readonly CONFIRM: "/confirm";
    readonly PROFILE: "/profile";
    readonly HISTORY: "/history";
    readonly NOTIFICATIONS: "/notifications";
    readonly RESCHEDULE: "/reschedule/:id";
    readonly NOT_FOUND: "*";
};
export declare const ADMIN_ROUTES: {
    readonly LOGIN: "/admin/login";
    readonly REGISTER: "/admin/register";
    readonly DASHBOARD: "/admin/dashboard";
    readonly APPOINTMENTS: "/admin/appointments";
    readonly APPOINTMENTS_CALENDAR: "/admin/appointments/calendar";
    readonly CLIENTS: "/admin/clients";
    readonly CLIENT_DETAIL: "/admin/clients/:id";
    readonly MASTERS: "/admin/masters";
    readonly MASTER_SCHEDULE: "/admin/masters/:id/schedule";
    readonly SERVICES: "/admin/services";
    readonly TEMPLATES: "/admin/templates";
    readonly TELEGRAM: "/admin/telegram";
    readonly MAILINGS: "/admin/mailings";
    readonly SETTINGS: "/admin/settings";
    readonly AUDIT: "/admin/audit";
};
export declare const API_ROUTES: {
    readonly BASE: "/api/v1";
    readonly AUTH: {
        readonly LOGIN: "/auth/login";
        readonly REGISTER: "/auth/register";
        readonly REFRESH: "/auth/refresh";
        readonly CHECK_SETUP: "/auth/check-setup";
        readonly VALIDATE_TELEGRAM: "/auth/validate-telegram";
    };
    readonly APPOINTMENTS: {
        readonly BASE: "/appointments";
        readonly CONFIRM: "/appointments/:id/confirm";
        readonly CANCEL: "/appointments/:id/cancel";
        readonly RESCHEDULE: "/appointments/:id/reschedule";
    };
    readonly SERVICES: {
        readonly BASE: "/services";
        readonly CATEGORIES: "/services/categories";
        readonly SUBCATEGORIES: "/services/subcategories";
    };
    readonly MASTERS: {
        readonly BASE: "/masters";
        readonly SCHEDULE: "/masters/:id/schedule";
    };
    readonly USERS: {
        readonly BASE: "/users";
        readonly PROFILE: "/users/profile";
    };
    readonly NOTIFICATIONS: {
        readonly BASE: "/notifications";
        readonly MARK_READ: "/notifications/:id/read";
    };
};
