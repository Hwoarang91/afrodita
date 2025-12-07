import { format, subDays } from 'date-fns';
import { fetchFromAPI } from '@/lib/api-server';
import { DashboardClient } from './DashboardClient';
import { cookies } from 'next/headers';

// Используем any для initialStats, так как тип будет проверен в DashboardClient

// Server Component для начальной загрузки данных
// Использует cookies для аутентификации
export default async function Dashboard() {
  // Получаем начальный диапазон дат (последние 30 дней)
  const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  let initialStats: any = undefined;
  let error = null;

  try {
    // Пытаемся загрузить данные на сервере
    // Если токен есть в cookies, данные загрузятся
    // Если нет - Client Component загрузит их на клиенте
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (token) {
      initialStats = await fetchFromAPI(`/analytics/dashboard?startDate=${startDate}&endDate=${endDate}`);
    }
  } catch (err: any) {
    // Если ошибка аутентификации или другие ошибки - игнорируем
    // Client Component загрузит данные самостоятельно
    if (process.env.NODE_ENV === 'development') {
      console.log('Server-side data fetch failed, will use client-side:', err.message);
    }
    error = err.message;
  }

  return (
    <DashboardClient
      initialStats={initialStats}
      initialDateRange={{ startDate, endDate }}
    />
  );
}
