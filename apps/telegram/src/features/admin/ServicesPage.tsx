import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ServicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const response = await apiClient.get('/services');
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      toast.success('Услуга удалена');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка удаления услуги');
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
            <h1 className="text-2xl font-bold mb-2">✨ Управление услугами</h1>
            <p className="text-muted-foreground">
              Всего услуг: {servicesData?.length || 0}
            </p>
          </div>

          <div className="space-y-3">
            {servicesData?.map((service: any) => (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="text-base">{service.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {service.description && (
                      <p>
                        <strong>Описание:</strong> {service.description}
                      </p>
                    )}
                    {service.category && (
                      <p>
                        <strong>Категория:</strong> {service.category}
                      </p>
                    )}
                    {service.duration && (
                      <p>
                        <strong>Длительность:</strong> {service.duration} минут
                      </p>
                    )}
                    {service.price !== undefined && (
                      <p>
                        <strong>Цена:</strong> {service.price} ₽
                      </p>
                    )}
                    <p>
                      <strong>Статус:</strong>{' '}
                      <span className={service.isActive ? 'text-green-500' : 'text-red-500'}>
                        {service.isActive ? 'Активна' : 'Неактивна'}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/services/${service.id}`)}
                    >
                      Подробнее
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Вы уверены, что хотите удалить эту услугу?')) {
                          deleteMutation.mutate(service.id);
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

          {servicesData?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Нет услуг</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}

