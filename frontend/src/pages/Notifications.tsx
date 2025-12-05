import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { AppointmentCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Notifications() {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Уведомления</h1>
        {isLoading ? (
          <div className="space-y-4">
            <AppointmentCardSkeleton />
            <AppointmentCardSkeleton />
            <AppointmentCardSkeleton />
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className="bg-card rounded-lg shadow-md p-6 border border-border"
              >
                <h3 className="font-semibold text-foreground mb-2">{notif.title}</h3>
                <p className="text-muted-foreground mb-2">{notif.message}</p>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(notif.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🔔"
            title="Нет уведомлений"
            description="Здесь будут отображаться ваши уведомления о записях и акциях."
          />
        )}
      </div>
    </div>
  );
}

