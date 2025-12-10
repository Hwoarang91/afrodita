import { apiClient } from './client';

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl?: string;
  bonusPointsPercent: number;
}

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

