const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface CreateContactRequestDto {
  name: string;
  phone: string;
  message?: string;
}

export const contactRequestsApi = {
  async create(data: CreateContactRequestDto) {
    const response = await fetch(`${API_URL}/contact-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Ошибка при отправке заявки' }));
      throw new Error(error.message || 'Ошибка при отправке заявки');
    }

    return await response.json();
  },
};

