import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      const response = await apiClient.get('/users?role=client');
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      toast.success('Клиент удален');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка удаления клиента');
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
            <h1 className="text-2xl font-bold mb-2">👥 Управление клиентами</h1>
            <p className="text-muted-foreground">
              Всего клиентов: {clientsData?.length || 0}
            </p>
          </div>

          <div className="space-y-3">
            {clientsData?.map((client: any) => (
              <Card key={client.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {client.firstName} {client.lastName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {client.email && (
                      <p>
                        <strong>Email:</strong> {client.email}
                      </p>
                    )}
                    {client.phone && (
                      <p>
                        <strong>Телефон:</strong> {client.phone}
                      </p>
                    )}
                    {client.telegramId && (
                      <p>
                        <strong>Telegram ID:</strong> {client.telegramId}
                      </p>
                    )}
                    {client.username && (
                      <p>
                        <strong>Username:</strong> @{client.username}
                      </p>
                    )}
                    <p>
                      <strong>Бонусные баллы:</strong> {client.bonusPoints || 0}
                    </p>
                    <p>
                      <strong>Статус:</strong>{' '}
                      <span className={client.isActive ? 'text-green-500' : 'text-red-500'}>
                        {client.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/clients/${client.id}`)}
                    >
                      Подробнее
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Вы уверены, что хотите удалить этого клиента?')) {
                          deleteMutation.mutate(client.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Удалить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {clientsData?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Нет клиентов</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}

