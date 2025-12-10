export declare enum UserRole {
    CLIENT = "client",
    ADMIN = "admin",
    MASTER = "master"
}
export declare enum AppointmentStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    RESCHEDULED = "rescheduled"
}
export interface User {
    id: string;
    telegramId?: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    role: UserRole;
    isActive: boolean;
    bonusPoints: number;
    createdAt: string;
    updatedAt: string;
}
export interface Appointment {
    id: string;
    clientId: string;
    serviceId: string;
    masterId?: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    price: number;
    discount?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    client?: User;
    service?: Service;
    master?: Master;
}
export interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    duration: number;
    category?: string;
    subcategory?: string;
    isCategory: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Master {
    id: string;
    userId: string;
    specialization?: string;
    experience?: number;
    rating?: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    user?: User;
    services?: Service[];
}
export interface Notification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    user?: User;
}
