import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '../../shared/api/services';
import { ServiceCardSkeleton } from '../../shared/components/SkeletonLoader';
import EmptyState from '../../shared/components/EmptyState';
import StepIndicator from '../../shared/components/StepIndicator';
import ServiceCard from './ServiceCard';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function Services() {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  
  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.getAll(),
    retry: 1,
  });

  // Фильтруем услуги по категории
  // API возвращает самостоятельные услуги и подкатегории
  const filteredServices = useMemo(() => {
    if (!services) return [];
    
    // Фильтруем: исключаем только категории (isCategory = true), но включаем подкатегории
    // Убираем проверку price > 0 и duration > 0, так как это может скрывать услуги
    const availableServices = services.filter(service => 
      !service.isCategory
    );
    
    if (selectedCategory === 'Все') return availableServices;
    
    // Фильтруем по строковому полю category (нечувствительно к регистру)
    // Бэкенд уже заполняет category у подкатегорий из родительской категории
    const selectedCategoryNormalized = selectedCategory.trim().toLowerCase();
    return availableServices.filter(service => {
      const serviceCategory = service.category?.trim().toLowerCase();
      return serviceCategory === selectedCategoryNormalized;
    });
  }, [services, selectedCategory]);

  // Получаем уникальные категории из всех услуг (включая подкатегории)
  // Бэкенд уже заполняет category у подкатегорий из родительской категории
  const sortedCategories = useMemo(() => {
    if (!services) return ['Все'];
    const cats = new Set<string>();
    
    services.forEach(service => {
      if (service.isCategory) return;
      const category = service.category?.trim();
      if (category) cats.add(category);
    });
    return cats.size > 0 ? ['Все', ...Array.from(cats).sort()] : ['Все'];
  }, [services]);

  // Логирование ошибок для отладки
  if (error) {
    console.error('Ошибка загрузки услуг:', error);
  }

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
    hapticFeedback.selectionChanged();
  };

  const selectedServicesArray = useMemo(() => {
    if (!services) return [];
    return services.filter(service => selectedServices.has(service.id));
  }, [services, selectedServices]);

  const totalPrice = useMemo(() => {
    return selectedServicesArray.reduce((sum, service) => sum + service.price, 0);
  }, [selectedServicesArray]);

  const handleContinue = () => {
    if (selectedServicesArray.length === 0) return;
    const firstService = selectedServicesArray[0];
    hapticFeedback.impactOccurred('medium');
    navigate(`/services/${firstService.id}`);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#2D1B22] dark:text-pink-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center p-4 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-[#2D1B22] shadow-sm"
          >
            <span className="material-symbols-outlined text-[#2D1B22] dark:text-pink-100">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-[#2D1B22] dark:text-white text-lg font-bold leading-tight tracking-tight">Выберите услугу</h2>
          </div>
          <div className="size-10"></div>
        </div>
        <StepIndicator currentStep={1} />
      </header>

      <main className="pb-32">
        {/* Category Filters */}
        <div className="flex gap-3 px-4 py-2 overflow-x-auto">
          {sortedCategories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                hapticFeedback.selectionChanged();
              }}
              className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-6 shadow-sm transition ${
                selectedCategory === category
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-white dark:bg-[#2D1B22] border border-pink-100 dark:border-pink-900/30 text-[#2D1B22] dark:text-pink-100 font-medium'
              }`}
            >
              <p className="text-sm">{category}</p>
            </button>
          ))}
        </div>

        {/* Services List */}
        <div className="flex flex-col gap-4 p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
            </div>
          ) : error ? (
            <EmptyState
              title="Ошибка загрузки услуг"
              description={error instanceof Error ? error.message : 'Не удалось загрузить услуги. Проверьте подключение к интернету.'}
              actionLabel="Обновить"
              onAction={() => window.location.reload()}
            />
          ) : filteredServices && filteredServices.length > 0 ? (
            filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedServices.has(service.id)}
                onToggle={() => toggleService(service.id)}
                onInfoClick={() => {
                  hapticFeedback.selectionChanged();
                }}
              />
            ))
          ) : (
            <EmptyState
              title="Услуги не найдены"
              description="В данный момент услуги временно недоступны. Попробуйте позже."
            />
          )}
        </div>
      </main>

      {/* Sticky Footer */}
      {selectedServicesArray.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-pink-100 dark:border-pink-900/30 p-4 pb-8 z-30">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleContinue}
              className="w-full h-14 bg-primary rounded-xl flex items-center justify-between px-6 shadow-lg shadow-pink-500/20 group active:scale-[0.98] transition-transform"
            >
              <div className="flex flex-col items-start text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Выбрана {selectedServicesArray.length} {selectedServicesArray.length === 1 ? 'услуга' : 'услуги'}
                </span>
                <span className="text-lg font-bold leading-tight">Продолжить</span>
              </div>
              <div className="flex items-center gap-3 text-white">
                <span className="text-xl font-bold">
                  {Number(totalPrice).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
                </span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
