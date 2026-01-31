import { apiClient } from './client';

export interface ExtraService {
  id: string;
  name: string;
  description?: string;
  price: number;
  icon?: string | null;
  isActive: boolean;
}

export const extraServicesApi = {
  getAll: async (): Promise<ExtraService[]> => {
    const { data } = await apiClient.get<ExtraService[]>('/extra-services');
    return Array.isArray(data) ? data : [];
  },
};
