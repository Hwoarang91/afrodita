'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function Home() {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        // Проверяем наличие администраторов в системе
        const { data } = await apiClient.get('/auth/check-setup');
        const hasUsers = data.hasUsers;

        if (!hasUsers) {
          // Если нет администраторов - редиректим на регистрацию
          router.push('/register');
        } else {
          // Если есть администраторы - редиректим на логин
          router.push('/login');
        }
      } catch (error) {
        console.error('Ошибка при проверке настройки системы:', error);
        // В случае ошибки редиректим на логин
        router.push('/login');
      } finally {
        setIsChecking(false);
      }
    };

    checkAndRedirect();
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return null;
}

