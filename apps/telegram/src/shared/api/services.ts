import { apiClient } from './client';
import type { Service } from '@shared/types';

// Re-export для обратной совместимости
export type { Service };

export const servicesApi = {
  getAll: async (category?: string): Promise<Service[]> => {
    const { data } = await apiClient.get('/services', {
      params: { category, limit: 1000 }, // Получаем все услуги для фронтенда
    });
    // API возвращает пагинированный ответ { data: [], total: ... }
    return Array.isArray(data) ? data : (data?.data || []);
  },
  getById: async (id: string): Promise<Service> => {
    const { data } = await apiClient.get(`/services/${id}`);
    return data;
  },
};

