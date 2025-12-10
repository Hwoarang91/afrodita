import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../shared/api/appointments';
import { AppointmentCardSkeleton } from '../../shared/components/SkeletonLoader';
import EmptyState from '../../shared/components/EmptyState';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function History() {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', 'history'],
    queryFn: () => appointmentsApi.getAll('completed'),
  });

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">История посещений</h1>
        {isLoading ? (
          <div className="space-y-3 sm:space-y-4">
            <AppointmentCardSkeleton />
            <AppointmentCardSkeleton />
            <AppointmentCardSkeleton />
          </div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {appointments.map((apt: any) => (
              <div
                key={apt.id}
                className="bg-card rounded-lg shadow-md p-4 sm:p-6 border border-border"
              >
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">{apt.service?.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">{apt.master?.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                </p>
                <p className="text-base sm:text-lg font-semibold text-primary">{apt.price} ₽</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📋"
            title="История посещений пуста"
            description="Здесь будут отображаться ваши завершенные записи."
          />
        )}
      </div>
    </div>
  );
}

