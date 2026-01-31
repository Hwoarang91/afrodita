import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { appointmentsApi } from '../../shared/api/appointments';
import { servicesApi } from '../../shared/api/services';
import { extraServicesApi, type ExtraService } from '../../shared/api/extra-services';
import { apiClient } from '../../shared/api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function AppointmentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { webApp, hapticFeedback } = useTelegram();
  const masterId = searchParams.get('masterId');
  const serviceId = searchParams.get('serviceId');
  const startTime = searchParams.get('startTime');

  const [notes, setNotes] = useState('');
  const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());

  useTelegramBackButton();

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onMutate: async (newAppointment) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const previousAppointments = queryClient.getQueryData(['appointments']);
      queryClient.setQueryData(['appointments'], (old: any) => {
        if (!old) return old;
        const optimisticAppointment = {
          id: `temp-${Date.now()}`,
          ...newAppointment,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        return Array.isArray(old) ? [...old, optimisticAppointment] : old;
      });
      return { previousAppointments };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments'], context.previousAppointments);
      }
      hapticFeedback.notificationOccurred('error');
      toast.error(error.response?.data?.message || 'Ошибка создания записи');
    },
    onSuccess: () => {
      hapticFeedback.notificationOccurred('success');
      toast.success('Запись успешно создана!');
      navigate('/profile');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleConfirm = () => {
    if (masterId && serviceId && startTime) {
      createMutation.mutate({
        masterId,
        serviceId,
        startTime,
        notes: notes.trim() || undefined,
        extraServiceIds: selectedExtraIds.size > 0 ? Array.from(selectedExtraIds) : undefined,
      });
    }
  };

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
    return () => {
      if (webApp?.MainButton) webApp.MainButton.hide();
    };
  }, [webApp]);

  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.getById(serviceId!),
    enabled: !!serviceId,
  });

  const { data: master } = useQuery({
    queryKey: ['master', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/masters/${masterId}`);
      return data;
    },
    enabled: !!masterId,
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

  if (!service || !master) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] shadow-xl overflow-x-hidden relative">
      <header className="sticky top-0 z-10 bg-[#fff9fa]/90 dark:bg-background-dark/90 backdrop-blur-md">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-12 shrink-0 items-center justify-start cursor-pointer text-[#3d2b31] dark:text-[#fce7f3]"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-semibold leading-tight tracking-tight flex-1 text-center">
            Доп. услуги
          </h2>
          <div className="size-12 shrink-0" />
        </div>
        <StepIndicator currentStep={4} />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="px-2 pb-2">
          <h3 className="text-xl font-bold text-[#2d1b22] dark:text-[#fff0f5]">Настройте ваш сеанс</h3>
          <p className="text-sm text-[#9d7886] dark:text-[#d4aebc]">
            Добавьте услуги для максимального расслабления.
          </p>
        </div>

        <div className="space-y-3">
          {extraServicesList.map((extra: ExtraService) => (
            <label
              key={extra.id}
              className="flex items-center gap-4 bg-white dark:bg-[#3d242f] border border-[#f9a8d4]/30 dark:border-[#5a3644] rounded-2xl px-4 min-h-[92px] py-3 cursor-pointer hover:border-primary transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="text-primary dark:text-[#f9a8d4] flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
                  <span className="material-symbols-outlined text-3xl">{extra.icon || 'spa'}</span>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">
                    {extra.name}
                  </p>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs font-normal leading-tight">
                    {extra.description || ''} (+{(Number(extra.price) || 0).toLocaleString('ru-RU')}₽)
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center">
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  checked={selectedExtraIds.has(extra.id)}
                  onChange={() => toggleExtra(extra.id)}
                />
              </div>
            </label>
          ))}
        </div>

        <div className="pt-4">
          <div className="flex items-center gap-2 mb-2 px-2 text-[#3d2b31] dark:text-[#fce7f3]">
            <span className="material-symbols-outlined text-sm">notes</span>
            <label className="text-base font-semibold">Особые пожелания</label>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-2xl border-[#f9a8d4]/40 dark:border-[#5a3644] bg-white dark:bg-[#3d242f] text-sm focus:ring-primary focus:border-primary dark:text-[#fce7f3] placeholder:text-[#9d7886]/50 p-4"
            placeholder="Напишите здесь об аллергиях, зонах внимания или температуре в кабинете..."
            rows={4}
          />
        </div>
        <div className="h-32" />
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#fff9fa] via-[#fff9fa] dark:from-background-dark dark:via-background-dark to-transparent pt-12 max-w-md mx-auto">
        <div className="flex flex-col gap-2">
          {!hasExtrasSelected && (
            <p className="text-center text-sm text-[#9d7886] dark:text-[#d4aebc]">
              Доп. услуги не выбраны
            </p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={createMutation.isPending}
            className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/25 hover:brightness-105 active:scale-95 transition-all disabled:opacity-70 flex flex-col items-center justify-center gap-0.5"
          >
            {hasExtrasSelected ? (
              <>
                <span>Продолжить</span>
                <span className="text-base font-semibold opacity-90">
                  {totalPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
                </span>
              </>
            ) : (
              'Продолжить'
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
