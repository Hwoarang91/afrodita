import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { appointmentsApi } from '../api/appointments';
import { ProfileSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentsApi.getAll('confirmed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(id, 'Отменено пользователем'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', 'upcoming'] });
      const previousAppointments = queryClient.getQueryData(['appointments', 'upcoming']);
      
      // Оптимистично удаляем запись из списка
      queryClient.setQueryData(['appointments', 'upcoming'], (old: any) => {
        if (!old) return old;
        return old.filter((apt: any) => apt.id !== id);
      });
      
      return { previousAppointments };
    },
    onError: (error: any, _id, context) => {
      // Откатываем изменения при ошибке
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments', 'upcoming'], context.previousAppointments);
      }
      toast.error(error.response?.data?.message || 'Ошибка при отмене записи');
    },
    onSuccess: () => {
      toast.success('Запись отменена');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
          <h1 className="text-3xl font-bold text-foreground mb-4">Профиль</h1>
          <div className="space-y-2">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Имя:</span> {user?.firstName} {user?.lastName}
            </p>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Бонусы:</span> {user?.bonusPoints || 0} баллов
            </p>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-foreground">Ближайшие записи</h2>
            <button
              onClick={() => navigate('/services')}
              className="text-primary hover:text-primary/80 font-semibold"
            >
              + Новая запись
            </button>
          </div>
          {appointments && appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((apt: any) => (
                <div
                  key={apt.id}
                  className="border border-border rounded-lg p-4 hover:shadow-md transition bg-card"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{apt.service?.name}</h3>
                      <p className="text-muted-foreground">{apt.master?.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                      </p>
                      <p className="text-primary font-semibold mt-1">{apt.price} ₽</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => navigate(`/reschedule/${apt.id}`)}
                      className="flex-1 bg-secondary text-secondary-foreground py-2 px-4 rounded-lg font-semibold hover:bg-secondary/80 transition text-sm"
                    >
                      🔄 Перенести
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Отменить запись?')) {
                          cancelMutation.mutate(apt.id);
                        }
                      }}
                      className="flex-1 bg-destructive/10 text-destructive py-2 px-4 rounded-lg font-semibold hover:bg-destructive/20 transition text-sm"
                    >
                      ❌ Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📅"
              title="Нет предстоящих записей"
              description="У вас пока нет записей. Запишитесь на услугу прямо сейчас!"
              actionLabel="Записаться"
              onAction={() => navigate('/services')}
            />
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/history')}
            className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition"
          >
            История
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition"
          >
            Уведомления
          </button>
        </div>
      </div>
    </div>
  );
}

