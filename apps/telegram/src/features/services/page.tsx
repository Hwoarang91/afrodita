import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '../../shared/api/services';
import { ServiceCardSkeleton } from '../../shared/components/SkeletonLoader';
import EmptyState from '../../shared/components/EmptyState';
import ServiceCard from './ServiceCard';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function Services() {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  
  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.getAll(),
    retry: 1,
  });

  // Логирование ошибок для отладки
  if (error) {
    console.error('Ошибка загрузки услуг:', error);
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">Наши услуги</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
          </div>
        ) : error ? (
          <EmptyState
            icon="❌"
            title="Ошибка загрузки услуг"
            description={error instanceof Error ? error.message : 'Не удалось загрузить услуги. Проверьте подключение к интернету.'}
            actionLabel="Обновить"
            onAction={() => window.location.reload()}
          />
        ) : services && services.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => {
                  hapticFeedback.selectionChanged();
                  navigate(`/services/${service.id}`);
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🔍"
            title="Услуги не найдены"
            description="В данный момент услуги временно недоступны. Попробуйте позже."
          />
        )}
      </div>
    </div>
  );
}

