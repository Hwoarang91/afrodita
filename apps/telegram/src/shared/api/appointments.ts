import { apiClient } from './client';
import type { Appointment } from '@shared/types';

// Re-export для обратной совместимости
export type { Appointment };

export const appointmentsApi = {
  create: async (data: {
    masterId: string;
    serviceId: string;
    startTime: string;
    notes?: string;
    extraServiceIds?: string[];
  }): Promise<Appointment> => {
    const { data: appointment } = await apiClient.post('/appointments', data);
    return appointment;
  },
  getAll: async (status?: string): Promise<Appointment[]> => {
    const { data } = await apiClient.get('/appointments', {
      params: { status },
    });
    return data;
  },
  getById: async (id: string): Promise<Appointment> => {
    const res = await apiClient.get(`/appointments/${id}`);
    const data = res.data?.data ?? res.data;
    return data as Appointment;
  },
  getAvailableSlots: async (
    masterId: string,
    serviceId: string,
    date: Date,
  ): Promise<string[]> => {
    const { data } = await apiClient.get('/appointments/slots', {
      params: {
        masterId,
        serviceId,
        date: date.toISOString(),
      },
    });
    return data;
  },
  cancel: async (id: string, reason?: string): Promise<void> => {
    await apiClient.delete(`/appointments/${id}`, { data: { reason } });
  },
  reschedule: async (id: string, newStartTime: string): Promise<Appointment> => {
    const { data } = await apiClient.patch(`/appointments/${id}/reschedule`, {
      startTime: newStartTime,
    });
    return data;
  },
};

