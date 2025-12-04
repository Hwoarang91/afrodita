'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error: any) => {
              // Не повторяем запросы при 401, 403, 404
              if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 404) {
                return false;
              }
              // Повторяем максимум 2 раза для других ошибок
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 минут
          },
          mutations: {
            retry: false,
            onError: (error: any) => {
              // Глобальная обработка ошибок мутаций
              const message = error?.response?.data?.message || error?.message || 'Произошла ошибка';
              if (typeof window !== 'undefined' && (window as any).showErrorToast) {
                (window as any).showErrorToast(message, 'error');
              } else if (process.env.NODE_ENV === 'development') {
                console.error('Mutation error:', error);
              }
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

