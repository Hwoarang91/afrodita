import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { servicesApi } from '../../shared/api/services';
import { extraServicesApi, type ExtraService } from '../../shared/api/extra-services';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function ExtrasStep() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { webApp, hapticFeedback } = useTelegram();
  const serviceId = searchParams.get('serviceId');

  const extraIdsFromUrl = searchParams.get('extraIds') || '';
  const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(() => {
    if (!extraIdsFromUrl) return new Set();
    return new Set(extraIdsFromUrl.split(',').filter(Boolean));
  });

  useTelegramBackButton();

  useEffect(() => {
    if (!serviceId) {
      navigate('/services', { replace: true });
    }
  }, [serviceId, navigate]);

  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
    return () => { if (webApp?.MainButton) webApp.MainButton.hide(); };
  }, [webApp]);

  const handleConfirm = () => {
    if (serviceId) {
      hapticFeedback.impactOccurred('medium');
      const params = new URLSearchParams({ serviceId });
      if (selectedExtraIds.size > 0) params.set('extraIds', Array.from(selectedExtraIds).join(','));
      navigate(`/masters?${params.toString()}`);
    }
  };

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    hapticFeedback.selectionChanged();
  };

  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.getById(serviceId!),
    enabled: !!serviceId,
  });

  const { data: extraServicesList = [] } = useQuery({
    queryKey: ['extra-services'],
    queryFn: () => extraServicesApi.getAll(),
  });

  const totalPrice = useMemo(() => {
    if (!service) return 0;
    const base = Number(service.price) || 0;
    const extrasSum = extraServicesList
      .filter((e) => selectedExtraIds.has(e.id))
      .reduce((sum, e) => sum + (Number(e.price) || 0), 0);
    return base + extrasSum;
  }, [service, extraServicesList, selectedExtraIds]);

  const hasExtrasSelected = selectedExtraIds.size > 0;

  if (!serviceId) {
    return <LoadingSpinner />;
  }

  if (!service) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] shadow-xl overflow-x-hidden relative">
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
            Доп. услуги
          </h2>
        </div>
        <StepIndicator currentStep={2} />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        <div className="px-2 pb-2">
          <h3 className="text-[#2d1b22] dark:text-[#fff0f5] text-lg font-bold">Настройте ваш сеанс</h3>
          <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">
            Добавьте услуги для максимального расслабления.
          </p>
        </div>

        <div className="space-y-3">
          {extraServicesList.map((extra: ExtraService) => (
            <label
              key={extra.id}
              className="flex items-center gap-4 bg-white dark:bg-[#3d242f] border border-pink-100/50 dark:border-pink-900/30 rounded-xl px-4 min-h-[72px] py-3 cursor-pointer hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
                  <span className="material-symbols-outlined text-2xl">{extra.icon || 'spa'}</span>
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">
                    {extra.name}
                  </p>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs font-normal leading-tight">
                    {extra.description || ''} (+{(Number(extra.price) || 0).toLocaleString('ru-RU')} ₽)
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-pink-300 text-primary focus:ring-primary cursor-pointer"
                checked={selectedExtraIds.has(extra.id)}
                onChange={() => toggleExtra(extra.id)}
              />
            </label>
          ))}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-pink-100 dark:border-pink-900/30 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-[430px] mx-auto">
        {!hasExtrasSelected && (
          <p className="text-center text-sm text-[#9d7886] dark:text-[#d4aebc] mb-2">
            Доп. услуги не выбраны
          </p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-12 rounded-xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {hasExtrasSelected ? `Продолжить · ${totalPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽` : 'Продолжить'}
        </button>
      </footer>
    </div>
  );
}
