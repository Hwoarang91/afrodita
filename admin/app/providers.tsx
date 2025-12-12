'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AxiosError, getErrorMessage } from '@/lib/types';

// Расширяем Window для showErrorToast
declare global {
  interface Window {
    showErrorToast?: (message: string, type: string) => void;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error: unknown) => {
              const axiosError = error as AxiosError;
              // Не повторяем запросы при 401, 403, 404
              if (axiosError?.response?.status === 401 || axiosError?.response?.status === 403 || axiosError?.response?.status === 404) {
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
            onError: (error: unknown) => {
              // Глобальная обработка ошибок мутаций
              const message = getErrorMessage(error);
              if (typeof window !== 'undefined' && window.showErrorToast) {
                window.showErrorToast(message, 'error');
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

