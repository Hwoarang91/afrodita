import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesApi } from '../../shared/api/services';
import { ServiceCardSkeleton } from '../../shared/components/SkeletonLoader';
import EmptyState from '../../shared/components/EmptyState';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

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
    <div className="min-h-screen max-w-[430px] mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] shadow-xl">
      <header className="sticky top-0 z-10 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-pink-100 dark:border-pink-900/30">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer text-[#3d2b31] dark:text-[#fce7f3]"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-12">
            Выберите услугу
          </h2>
        </div>
        <StepIndicator currentStep={1} />
      </header>
      <div className="p-4 pb-28">
        <div className="rounded-2xl border border-pink-100 dark:border-pink-900/30 bg-white dark:bg-[#3d242f]/50 overflow-hidden shadow-sm">
          {service.imageUrl && (
            <img
              src={service.imageUrl}
              alt={service.name}
              className="w-full aspect-video object-cover"
            />
          )}
          <div className="p-5">
            <h1 className="text-[#3d2b31] dark:text-[#fce7f3] text-xl font-bold leading-tight tracking-tight">{service.name}</h1>
            <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm mt-2">{service.description}</p>
            <div className="flex justify-between items-center mt-4">
              <span className="text-primary text-lg font-bold">{Number(service.price).toLocaleString('ru-RU')} ₽</span>
              <span className="text-[#9d7886] dark:text-[#d4aebc] text-sm">{service.duration} минут</span>
            </div>
          </div>
        </div>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 z-20 max-w-[430px] mx-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-pink-100 dark:border-pink-900/30">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.impactOccurred('medium');
            navigate(`/extras?serviceId=${service.id}`);
          }}
          className="w-full h-12 rounded-xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.98] transition-all"
        >
          Продолжить
        </button>
      </footer>
    </div>
  );
}

