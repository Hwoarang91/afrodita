import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesApi } from '../api/services';
import { ServiceCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useTelegram } from '../contexts/TelegramContext';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  
  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();
  const { data: service, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-2 sm:p-4">
        <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-md p-4 sm:p-6 border border-border">
          <ServiceCardSkeleton />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background p-2 sm:p-4">
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon="❌"
            title="Услуга не найдена"
            description="Запрашиваемая услуга не существует или была удалена."
            actionLabel="Вернуться к услугам"
            onAction={() => navigate('/services')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-md p-4 sm:p-6 border border-border">
        {service.imageUrl && (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-48 sm:h-64 object-cover rounded-lg mb-4 sm:mb-6 border border-border"
          />
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">{service.name}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">{service.description}</p>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div>
            <span className="text-2xl sm:text-3xl font-bold text-primary">{service.price} ₽</span>
          </div>
          <div className="text-muted-foreground">
            <span className="text-base sm:text-lg">{service.duration} минут</span>
          </div>
        </div>
        <button
          onClick={() => {
            hapticFeedback.impactOccurred('medium');
            navigate(`/masters?serviceId=${service.id}`);
          }}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition text-base sm:text-lg"
        >
          Выбрать мастера
        </button>
      </div>
    </div>
  );
}

