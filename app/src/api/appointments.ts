import { apiClient } from './client';

export interface Appointment {
  id: string;
  clientId: string;
  masterId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  bonusPointsUsed: number;
  bonusPointsEarned: number;
  master?: any;
  service?: any;
}

export const appointmentsApi = {
  create: async (data: {
    masterId: string;
    serviceId: string;
    startTime: string;
    notes?: string;
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
    const { data } = await apiClient.get(`/appointments/${id}`);
    return data;
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

