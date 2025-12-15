import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import AdminGuard from '../../shared/components/AdminGuard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function MastersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: mastersData, isLoading } = useQuery({
    queryKey: ['admin-masters'],
    queryFn: async () => {
      const response = await apiClient.get('/masters');
      return response.data?.data || response.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/masters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-masters'] });
      toast.success('Мастер удален');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка удаления мастера');
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
            <h1 className="text-2xl font-bold mb-2">👨‍💼 Управление мастерами</h1>
            <p className="text-muted-foreground">
              Всего мастеров: {mastersData?.length || 0}
            </p>
          </div>

          <div className="space-y-3">
            {mastersData?.map((master: any) => (
              <Card key={master.id}>
                <CardHeader>
                  <CardTitle className="text-base">{master.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {master.specialization && (
                      <p>
                        <strong>Специализация:</strong> {master.specialization}
                      </p>
                    )}
                    {master.description && (
                      <p>
                        <strong>Описание:</strong> {master.description}
                      </p>
                    )}
                    {master.experience && (
                      <p>
                        <strong>Опыт:</strong> {master.experience} лет
                      </p>
                    )}
                    {master.phone && (
                      <p>
                        <strong>Телефон:</strong> {master.phone}
                      </p>
                    )}
                    {master.email && (
                      <p>
                        <strong>Email:</strong> {master.email}
                      </p>
                    )}
                    <p>
                      <strong>Статус:</strong>{' '}
                      <span className={master.isActive ? 'text-green-500' : 'text-red-500'}>
                        {master.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/masters/${master.id}`)}
                    >
                      Подробнее
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Вы уверены, что хотите удалить этого мастера?')) {
                          deleteMutation.mutate(master.id);
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

          {mastersData?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Нет мастеров</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}

