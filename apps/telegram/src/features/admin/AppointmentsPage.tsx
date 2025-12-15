import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['admin-appointments'],
    queryFn: async () => {
      const response = await apiClient.get('/appointments');
      return response.data?.data || response.data || [];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/appointments/${id}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      toast.success('Запись подтверждена');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка подтверждения записи');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await apiClient.post(`/appointments/${id}/cancel-admin`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      toast.success('Запись отменена');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка отмены записи');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/appointments/${id}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] });
      toast.success('Запись удалена');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка удаления записи');
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

  const pendingAppointments = appointments?.filter((apt: any) => apt.status === 'pending') || [];
  const confirmedAppointments = appointments?.filter((apt: any) => apt.status === 'confirmed') || [];
  const completedAppointments = appointments?.filter((apt: any) => apt.status === 'completed') || [];
  const cancelledAppointments = appointments?.filter((apt: any) => apt.status === 'cancelled') || [];

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
            <h1 className="text-2xl font-bold mb-2">📋 Управление записями</h1>
            <p className="text-muted-foreground">
              Всего записей: {appointments?.length || 0}
            </p>
          </div>

          {/* Ожидают подтверждения */}
          {pendingAppointments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-orange-500">
                Ожидают подтверждения ({pendingAppointments.length})
              </h2>
              <div className="space-y-3">
                {pendingAppointments.map((apt: any) => (
                  <Card key={apt.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {apt.service?.name || 'Услуга не указана'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Клиент:</strong> {apt.user?.firstName} {apt.user?.lastName}
                        </p>
                        <p>
                          <strong>Мастер:</strong> {apt.master?.name || 'Не указан'}
                        </p>
                        <p>
                          <strong>Дата и время:</strong>{' '}
                          {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                        <p>
                          <strong>Цена:</strong> {apt.price} ₽
                        </p>
                        {apt.notes && (
                          <p>
                            <strong>Примечания:</strong> {apt.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => confirmMutation.mutate(apt.id)}
                          disabled={confirmMutation.isPending}
                        >
                          Подтвердить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate({ id: apt.id })}
                          disabled={cancelMutation.isPending}
                        >
                          Отменить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Подтвержденные */}
          {confirmedAppointments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-green-500">
                Подтвержденные ({confirmedAppointments.length})
              </h2>
              <div className="space-y-3">
                {confirmedAppointments.map((apt: any) => (
                  <Card key={apt.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {apt.service?.name || 'Услуга не указана'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Клиент:</strong> {apt.user?.firstName} {apt.user?.lastName}
                        </p>
                        <p>
                          <strong>Мастер:</strong> {apt.master?.name || 'Не указан'}
                        </p>
                        <p>
                          <strong>Дата и время:</strong>{' '}
                          {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                        <p>
                          <strong>Цена:</strong> {apt.price} ₽
                        </p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate({ id: apt.id })}
                          disabled={cancelMutation.isPending}
                        >
                          Отменить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(apt.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Удалить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Завершенные */}
          {completedAppointments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">
                Завершенные ({completedAppointments.length})
              </h2>
              <div className="space-y-3">
                {completedAppointments.map((apt: any) => (
                  <Card key={apt.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {apt.service?.name || 'Услуга не указана'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Клиент:</strong> {apt.user?.firstName} {apt.user?.lastName}
                        </p>
                        <p>
                          <strong>Мастер:</strong> {apt.master?.name || 'Не указан'}
                        </p>
                        <p>
                          <strong>Дата и время:</strong>{' '}
                          {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                        <p>
                          <strong>Цена:</strong> {apt.price} ₽
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Отмененные */}
          {cancelledAppointments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-500">
                Отмененные ({cancelledAppointments.length})
              </h2>
              <div className="space-y-3">
                {cancelledAppointments.map((apt: any) => (
                  <Card key={apt.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {apt.service?.name || 'Услуга не указана'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Клиент:</strong> {apt.user?.firstName} {apt.user?.lastName}
                        </p>
                        <p>
                          <strong>Мастер:</strong> {apt.master?.name || 'Не указан'}
                        </p>
                        <p>
                          <strong>Дата и время:</strong>{' '}
                          {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                        {apt.cancellationReason && (
                          <p>
                            <strong>Причина отмены:</strong> {apt.cancellationReason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(apt.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Удалить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {appointments?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Нет записей</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}

