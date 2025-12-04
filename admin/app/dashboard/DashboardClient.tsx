'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { ExportButton } from '../components/ExportButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Динамический импорт с правильной обработкой для Docker
const Chart = dynamic(
  () => import('react-apexcharts'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground border border-border rounded">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>Загрузка графика...</p>
        </div>
      </div>
    ),
  }
);

interface DashboardStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  revenue: number;
  activeMasters: number;
  completionRate: number;
  appointmentsByDay: {
    labels: string[];
    data: number[];
  };
  revenueByDay: {
    labels: string[];
    data: number[];
  };
  statusDistribution: {
    completed: number;
    cancelled: number;
    pending: number;
    confirmed: number;
  };
  masterStats: Array<{
    masterId: string;
    masterName: string;
    masterPhotoUrl?: string;
    revenue: number;
    completedAppointments: number;
  }>;
  serviceStats: Array<{
    name: string;
    revenue: number;
    count: number;
  }>;
}

interface DashboardClientProps {
  initialStats?: DashboardStats;
  initialDateRange?: {
    startDate: string;
    endDate: string;
  };
}

export function DashboardClient({ initialStats, initialDateRange }: DashboardClientProps) {
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }
  );

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/dashboard', {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      });
      return data;
    },
    initialData: initialStats, // Используем данные из Server Component
    staleTime: 0, // Всегда обновляем при изменении дат
  });

  const exportData = stats ? [
    ['Показатель', 'Значение'],
    ['Всего записей', stats.totalAppointments || 0],
    ['Завершено', stats.completedAppointments || 0],
    ['Отменено', stats.cancelledAppointments || 0],
    ['Ожидает подтверждения', stats.pendingAppointments || 0],
    ['Подтверждено', stats.confirmedAppointments || 0],
    ['Выручка', `${stats.revenue || 0} ₽`],
    ['Активные мастера', stats.activeMasters || 0],
    ['Процент выполнения', `${stats.completionRate?.toFixed(1) || 0}%`],
  ] : [];

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  const appointmentsChartOptions = {
    chart: {
      type: 'line' as const,
      toolbar: { show: false },
    },
    xaxis: {
      categories: stats?.appointmentsByDay?.labels || [],
    },
    yaxis: {
      title: { text: 'Количество записей' },
    },
    colors: ['#3B82F6'],
    title: {
      text: 'Записи по дням (последние 7 дней)',
      style: { fontSize: '16px', fontWeight: 'bold' },
    },
  };

  const revenueChartOptions = {
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
    },
    xaxis: {
      categories: stats?.revenueByDay?.labels || [],
    },
    yaxis: {
      title: { text: 'Выручка (₽)' },
    },
    colors: ['#10B981'],
    title: {
      text: 'Выручка по дням (последние 7 дней)',
      style: { fontSize: '16px', fontWeight: 'bold' },
    },
  };

  const statusChartOptions = {
    chart: {
      type: 'pie' as const,
      toolbar: { show: false },
    },
    labels: ['Завершено', 'Отменено', 'Ожидает', 'Подтверждено'],
    colors: ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'],
    title: {
      text: 'Распределение по статусам',
      style: { fontSize: '16px', fontWeight: 'bold' },
    },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Статистика</h1>
          <p className="text-muted-foreground mt-1">
            Обзор работы салона за выбранный период
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="w-auto"
          />
          <Input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="w-auto"
          />
          {stats && (
            <ExportButton
              data={exportData}
              filename="statistics_report"
              title="Отчет статистики"
              headers={exportData[0]}
            />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Всего записей</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalAppointments || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Завершено: {stats?.completedAppointments || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Выручка</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.revenue || 0} ₽</div>
            <p className="text-xs text-muted-foreground mt-2">За период</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Активные мастера</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.activeMasters || 0}</div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Процент выполнения</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.completionRate?.toFixed(1) || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Записи по дням</CardTitle>
            <CardDescription>Последние 7 дней</CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              options={appointmentsChartOptions}
              series={[{ name: 'Записи', data: stats?.appointmentsByDay?.data || [] }]}
              type="line"
              height={350}
            />
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Выручка по дням</CardTitle>
            <CardDescription>Последние 7 дней</CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              options={revenueChartOptions}
              series={[{ name: 'Выручка', data: stats?.revenueByDay?.data || [] }]}
              type="bar"
              height={350}
            />
          </CardContent>
        </Card>
      </div>

      {/* Status and Masters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Распределение по статусам</CardTitle>
            <CardDescription>Общая статистика записей</CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              options={statusChartOptions}
              series={[
                stats?.statusDistribution?.completed || 0,
                stats?.statusDistribution?.cancelled || 0,
                stats?.statusDistribution?.pending || 0,
                stats?.statusDistribution?.confirmed || 0,
              ]}
              type="pie"
              height={350}
            />
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Топ мастеров по выручке</CardTitle>
            <CardDescription>Лучшие мастера за период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.masterStats?.slice(0, 5).map((master: any, index: number) => (
                <div
                  key={master.masterId}
                  className="flex justify-between items-center p-3 rounded-lg hover:bg-accent transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    {master.masterPhotoUrl ? (
                      <img
                        src={master.masterPhotoUrl}
                        alt={master.masterName}
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {master.masterName?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{master.masterName}</div>
                      <div className="text-sm text-muted-foreground">{master.completedAppointments} записей</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">{master.revenue} ₽</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Section */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Топ услуг по выручке</CardTitle>
          <CardDescription>Популярные услуги за период</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.serviceStats?.map((service: any, index: number) => (
              <div
                key={index}
                className="p-4 border border-border rounded-lg bg-muted/50 hover:bg-muted transition-colors duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">#{index + 1}</span>
                  <span className="text-lg font-bold text-primary">{service.revenue} ₽</span>
                </div>
                <div className="font-medium mb-1">{service.name}</div>
                <div className="text-sm text-muted-foreground">{service.count} записей</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

