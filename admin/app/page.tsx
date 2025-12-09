'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export default function Home() {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        // Проверяем наличие администраторов в системе
        const { data } = await apiClient.get('/auth/check-setup');
        const hasUsers = data.hasUsers;

        if (!hasUsers) {
          // Если нет администраторов - редиректим на регистрацию
          window.location.href = '/admin/register';
        } else {
          // Если есть администраторы - редиректим на логин
          window.location.href = '/admin/login';
        }
      } catch (error) {
        console.error('Ошибка при проверке настройки системы:', error);
        // В случае ошибки редиректим на логин
        window.location.href = '/admin/login';
      } finally {
        setIsChecking(false);
      }
    };

    checkAndRedirect();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return null;
}

