import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { useAuthStore } from '../../store/authStore';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersRes, appointmentsRes, servicesRes, mastersRes] = await Promise.all([
        apiClient.get('/users?role=client'),
        apiClient.get('/appointments'),
        apiClient.get('/services'),
        apiClient.get('/masters'),
      ]);

      const appointments = appointmentsRes.data?.data || appointmentsRes.data || [];
      const pending = appointments.filter((apt: any) => apt.status === 'pending').length;
      const confirmed = appointments.filter((apt: any) => apt.status === 'confirmed').length;
      const upcoming = appointments.filter((apt: any) => {
        const startTime = new Date(apt.startTime);
        return startTime >= new Date() && (apt.status === 'pending' || apt.status === 'confirmed');
      }).length;

      return {
        clients: usersRes.data?.data?.length || usersRes.data?.total || 0,
        appointments: appointments.length,
        pending,
        confirmed,
        upcoming,
        services: servicesRes.data?.data?.length || servicesRes.data?.length || 0,
        masters: mastersRes.data?.data?.length || mastersRes.data?.length || 0,
      };
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
            <h1 className="text-2xl font-bold mb-2">🔐 Админ-панель</h1>
            <p className="text-muted-foreground">
              Добро пожаловать, {user?.firstName} {user?.lastName}
            </p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Клиенты</div>
              <div className="text-2xl font-bold">{stats?.clients || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Всего записей</div>
              <div className="text-2xl font-bold">{stats?.appointments || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Ожидают подтверждения</div>
              <div className="text-2xl font-bold text-orange-500">{stats?.pending || 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Предстоящие записи</div>
              <div className="text-2xl font-bold text-green-500">{stats?.upcoming || 0}</div>
            </Card>
          </div>

          {/* Быстрые действия */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mb-3">Быстрые действия</h2>
            
            <Button
              onClick={() => navigate('/admin/appointments')}
              className="w-full justify-start"
              variant="outline"
            >
              📋 Управление записями
            </Button>
            
            <Button
              onClick={() => navigate('/admin/clients')}
              className="w-full justify-start"
              variant="outline"
            >
              👥 Управление клиентами
            </Button>
            
            <Button
              onClick={() => navigate('/admin/masters')}
              className="w-full justify-start"
              variant="outline"
            >
              👨‍💼 Управление мастерами
            </Button>
            
            <Button
              onClick={() => navigate('/admin/services')}
              className="w-full justify-start"
              variant="outline"
            >
              ✨ Управление услугами
            </Button>
            
            <Button
              onClick={() => navigate('/admin/stats')}
              className="w-full justify-start"
              variant="outline"
            >
              📊 Подробная статистика
            </Button>

            <div className="pt-4 border-t">
              <Button
                onClick={() => navigate('/')}
                className="w-full"
                variant="ghost"
              >
                ← Вернуться в приложение
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

