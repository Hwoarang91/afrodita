import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { appointmentsApi } from '../../shared/api/appointments';
import { ProfileSkeleton } from '../../shared/components/SkeletonLoader';
import EmptyState from '../../shared/components/EmptyState';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { hapticFeedback } = useTelegram();
  
  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();

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
      hapticFeedback.notificationOccurred('error');
      toast.error(error.response?.data?.message || 'Ошибка при отмене записи');
    },
    onSuccess: () => {
      hapticFeedback.notificationOccurred('success');
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
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border border-border">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Профиль</h1>
          <div className="space-y-2">
            <p className="text-sm sm:text-base text-muted-foreground">
              <span className="font-semibold text-foreground">Имя:</span> {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              <span className="font-semibold text-foreground">Бонусы:</span> {user?.bonusPoints || 0} баллов
            </p>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ближайшие записи</h2>
            <button
              onClick={() => {
                hapticFeedback.impactOccurred('light');
                navigate('/services');
              }}
              className="text-sm sm:text-base text-primary hover:text-primary/80 font-semibold"
            >
              + Новая запись
            </button>
          </div>
          {appointments && appointments.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {appointments.map((apt: any) => (
                <div
                  key={apt.id}
                  className="border border-border rounded-lg p-3 sm:p-4 hover:shadow-md transition bg-card"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{apt.service?.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{apt.master?.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                      </p>
                      <p className="text-base sm:text-lg text-primary font-semibold mt-1">{apt.price} ₽</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 sm:mt-4">
                    <button
                      onClick={() => {
                        hapticFeedback.impactOccurred('light');
                        navigate(`/reschedule/${apt.id}`);
                      }}
                      className="flex-1 bg-secondary text-secondary-foreground py-2 px-3 sm:px-4 rounded-lg font-semibold hover:bg-secondary/80 transition text-xs sm:text-sm"
                    >
                      🔄 Перенести
                    </button>
                    <button
                      onClick={() => {
                        hapticFeedback.impactOccurred('light');
                        if (confirm('Отменить запись?')) {
                          cancelMutation.mutate(apt.id);
                        }
                      }}
                      className="flex-1 bg-destructive/10 text-destructive py-2 px-3 sm:px-4 rounded-lg font-semibold hover:bg-destructive/20 transition text-xs sm:text-sm"
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

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <button
            onClick={() => navigate('/history')}
            className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition text-sm sm:text-base"
          >
            История
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-accent transition text-sm sm:text-base"
          >
            Уведомления
          </button>
        </div>
      </div>
    </div>
  );
}

