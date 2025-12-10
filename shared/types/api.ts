// Общие типы для API ответов

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: any;
}

// Типы для аутентификации
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    role: string;
  };
}

export interface CheckSetupResponse {
  hasUsers: boolean;
}

// Типы для записей
export interface CreateAppointmentRequest {
  serviceId: string;
  masterId?: string;
  startTime: string;
  notes?: string;
}

export interface RescheduleAppointmentRequest {
  startTime: string;
  notes?: string;
}

// Типы для услуг
export interface CreateServiceRequest {
  name: string;
  description?: string;
  price: number;
  duration: number;
  category?: string;
  subcategory?: string;
  isCategory: boolean;
}

// Типы для мастеров
export interface CreateMasterRequest {
  userId: string;
  specialization?: string;
  experience?: number;
  serviceIds?: string[];
}

