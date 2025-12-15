import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';

export default function StatsPage() {
  const navigate = useNavigate();

  const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get('/analytics/dashboard', {
        params: {
          startDate,
          endDate,
        },
      });
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <AdminGuard>
        <div className="min-h-screen p-4">
          <LoadingSpinner />
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen p-4 bg-gradient-to-br from-primary/5 to-background">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              onClick={() => navigate('/admin')}
              variant="ghost"
              className="mb-4"
            >
              ← Назад
            </Button>
            <h1 className="text-2xl font-bold mb-2">📊 Подробная статистика</h1>
            <p className="text-muted-foreground">
              Период: {format(new Date(startDate), 'd MMM yyyy')} - {format(new Date(endDate), 'd MMM yyyy')}
            </p>
          </div>

          {/* Основные показатели */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Всего записей</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalAppointments || 0}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  Завершено: {stats?.completedAppointments || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выручка</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.revenue || 0} ₽</div>
                <p className="text-sm text-muted-foreground mt-2">За период</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Активные мастера</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeMasters || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Процент выполнения</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.completionRate?.toFixed(1) || 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Статусы записей */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Распределение по статусам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Ожидают подтверждения</span>
                  <span className="font-semibold text-orange-500">
                    {stats?.pendingAppointments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Подтверждено</span>
                  <span className="font-semibold text-blue-500">
                    {stats?.confirmedAppointments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Завершено</span>
                  <span className="font-semibold text-green-500">
                    {stats?.completedAppointments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Отменено</span>
                  <span className="font-semibold text-red-500">
                    {stats?.cancelledAppointments || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Статистика по мастерам */}
          {stats?.masterStats && stats.masterStats.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Статистика по мастерам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.masterStats.map((master: any) => (
                    <div key={master.masterId} className="border-b border-border pb-3 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{master.masterName}</p>
                          <p className="text-sm text-muted-foreground">
                            Завершено записей: {master.completedAppointments}
                          </p>
                        </div>
                        <p className="font-bold text-primary">{master.revenue} ₽</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Статистика по услугам */}
          {stats?.serviceStats && stats.serviceStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Статистика по услугам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.serviceStats.map((service: any, index: number) => (
                    <div key={index} className="border-b border-border pb-3 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Количество: {service.count}
                          </p>
                        </div>
                        <p className="font-bold text-primary">{service.revenue} ₽</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}

