'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin-token');
    const isLoginPage = pathname === '/login';

    // Синхронизируем токен с cookies для Server Components
    if (token) {
      // Проверяем, есть ли уже cookie
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin-token='))
        ?.split('=')[1];
      
      // Если токен в localStorage, но нет в cookies - добавляем в cookies
      if (token && !cookieToken) {
        document.cookie = `admin-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
    }

    // Определяем базовый путь из текущего URL
    const basePath = pathname.startsWith('/admin') ? '/admin' : '';
    
    if (!token && !isLoginPage) {
      router.push(`${basePath}/login`);
    } else if (token && isLoginPage) {
      router.push(`${basePath}/dashboard`);
    } else {
      setIsChecking(false);
    }
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return <>{children}</>;
}

