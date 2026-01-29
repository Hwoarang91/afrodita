import { apiClient } from './client';
import type { Service } from '@shared/types';

// Re-export для обратной совместимости
export type { Service };

export const servicesApi = {
  // Получить только самостоятельные услуги (без категорий и подкатегорий)
  getAll: async (category?: string): Promise<Service[]> => {
    const { data } = await apiClient.get('/services/main', {
      params: category ? { category } : {}, // Фильтр по категории если указан
    });
    // API возвращает массив самостоятельных услуг
    return Array.isArray(data) ? data : [];
  },
  // Получить подкатегории для категории
  getSubcategories: async (categoryId: string): Promise<Service[]> => {
    const { data } = await apiClient.get(`/services/${categoryId}/subcategories`);
    return Array.isArray(data) ? data : [];
  },
  getById: async (id: string): Promise<Service> => {
    const { data } = await apiClient.get(`/services/${id}`);
    return data;
  },
};

