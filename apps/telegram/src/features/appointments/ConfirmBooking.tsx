import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { appointmentsApi } from '../../shared/api/appointments';
import { servicesApi } from '../../shared/api/services';
import { extraServicesApi } from '../../shared/api/extra-services';
import { getBookingTerms } from '../../shared/api/settings';
import { apiClient } from '../../shared/api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

function formatDateRu(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' });
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function formatTimeRange(iso: string, durationMinutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ConfirmBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { webApp, hapticFeedback } = useTelegram();
  const masterId = searchParams.get('masterId');
  const serviceId = searchParams.get('serviceId');
  const startTime = searchParams.get('startTime');
  const extraIdsParam = searchParams.get('extraIds') || '';
  const extraIds = useMemo(() => extraIdsParam ? extraIdsParam.split(',').filter(Boolean) : [], [extraIdsParam]);
  const notes = (location.state as { notes?: string } | null)?.notes;
  const [termsAccepted, setTermsAccepted] = useState(false);

  useTelegramBackButton();

  const { data: bookingTerms } = useQuery({
    queryKey: ['booking-terms'],
    queryFn: getBookingTerms,
  });

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
    onSuccess: (created) => {
      hapticFeedback.notificationOccurred('success');
      toast.success('Запись успешно создана!');
      const id = created?.id ?? (created as any)?.data?.id;
      if (id) {
        navigate(`/booking-success/${id}`);
      } else {
        navigate('/profile');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handlePayAndBook = () => {
    if (masterId && serviceId && startTime) {
      createMutation.mutate({
        masterId,
        serviceId,
        startTime,
        notes: notes?.trim() || undefined,
        extraServiceIds: extraIds.length > 0 ? extraIds : undefined,
      });
    }
  };

  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
    return () => { if (webApp?.MainButton) webApp.MainButton.hide(); };
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

  const selectedExtras = useMemo(
    () => extraServicesList.filter((e: { id: string }) => extraIds.includes(e.id)),
    [extraServicesList, extraIds],
  );
  const extrasSum = useMemo(
    () => selectedExtras.reduce((s: number, e: { price: number }) => s + (Number(e.price) || 0), 0),
    [selectedExtras],
  );
  const servicePrice = service ? Number(service.price) || 0 : 0;
  const totalPrice = servicePrice + extrasSum;

  const goToServices = () => navigate('/services');
  const goToMasters = () => navigate(`/masters?serviceId=${serviceId}`);
  const goToCalendar = () => navigate(`/calendar?masterId=${masterId}&serviceId=${serviceId}`);
  const goToExtras = () => {
    const params = new URLSearchParams({ masterId: masterId!, serviceId: serviceId!, startTime: startTime! });
    if (extraIds.length) params.set('extraIds', extraIds.join(','));
    navigate(`/confirm?${params.toString()}`, { state: { notes } });
  };

  useEffect(() => {
    if (!masterId || !serviceId || !startTime) {
      navigate('/services');
    }
  }, [masterId, serviceId, startTime, navigate]);

  if (!masterId || !serviceId || !startTime) {
    return <LoadingSpinner />;
  }

  if (!service || !master) {
    return <LoadingSpinner />;
  }

  const duration = service.duration || 60;

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] shadow-xl relative">
      <header className="sticky top-0 z-10 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-pink-100 dark:border-pink-900/30">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer text-[#3d2b31] dark:text-[#fce7f3]"
          >
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <h2 className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-12">
            Подтверждение записи
          </h2>
        </div>
        <StepIndicator currentStep={5} />
      </header>

      <main className="flex-1 overflow-y-auto pb-36">
        <h3 className="text-[#2d1b22] dark:text-[#fff0f5] text-lg font-bold px-4 pb-2 pt-4">Детали записи</h3>
        <div className="space-y-1 px-4">
          {/* Услуга */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30 justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
                <span className="material-symbols-outlined text-2xl">spa</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">{service.name}</p>
                <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">{duration} минут</p>
              </div>
            </div>
            <button type="button" onClick={goToServices} className="shrink-0 text-primary cursor-pointer p-2">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>

          {/* Мастер */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30 justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {master.photoUrl ? (
                <div
                  className="shrink-0 size-12 rounded-full bg-center bg-cover border-2 border-primary/20"
                  style={{ backgroundImage: `url("${master.photoUrl}")` }}
                />
              ) : (
                <div className="shrink-0 size-12 rounded-full bg-[#fdf2f8] dark:bg-[#5a3644] flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">person</span>
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">{master.name}</p>
                <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Специалист</p>
              </div>
            </div>
            <button type="button" onClick={goToMasters} className="shrink-0 text-primary cursor-pointer p-2">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>

          {/* Дата и время */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30 justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
                <span className="material-symbols-outlined text-2xl">calendar_today</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">{startTime ? formatDateRu(startTime) : '—'}</p>
                <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">{startTime ? formatTimeRange(startTime, duration) : '—'}</p>
              </div>
            </div>
            <button type="button" onClick={goToCalendar} className="shrink-0 text-primary cursor-pointer p-2">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>

          {/* Доп. услуги — кликабельно, возврат на шаг 4 */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30 justify-between">
            <button type="button" onClick={goToExtras} className="flex items-center gap-4 flex-1 min-w-0 text-left">
              <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
                <span className="material-symbols-outlined text-2xl">add_circle</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">
                  {selectedExtras.length > 0
                    ? selectedExtras.map((e: { name: string }) => e.name).join(', ')
                    : 'Доп. услуги'}
                </p>
                <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">
                  {selectedExtras.length > 0 ? `${selectedExtras.length} ${selectedExtras.length === 1 ? 'услуга включена' : 'услуги включены'}` : 'Не выбраны'}
                </p>
              </div>
            </button>
            <button type="button" onClick={goToExtras} className="shrink-0 text-primary cursor-pointer p-2">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>
        </div>

        {/* Стоимость */}
        <div className="m-4 p-4 rounded-2xl bg-[#fdf2f8]/50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-900/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#9d7886] dark:text-[#d4aebc]">Стоимость услуг</span>
            <span className="text-[#3d2b31] dark:text-[#fce7f3] font-medium">
              {(servicePrice + extrasSum).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
            </span>
          </div>
          <div className="border-t border-pink-100 dark:border-pink-900/30 pt-3 flex justify-between items-center">
            <span className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-bold">Итого</span>
            <span className="text-primary text-2xl font-black">
              {totalPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
            </span>
          </div>
        </div>

        {/* Только «Оплата в салоне» — без выбора */}
        <div className="px-4 pt-2 pb-2">
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-pink-100 dark:border-pink-900/30 bg-white/50 dark:bg-[#3d242f]/50">
            <span className="material-symbols-outlined text-primary">payments</span>
            <span className="text-[#3d2b31] dark:text-[#fce7f3] font-medium">Оплата в салоне</span>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-pink-100 dark:border-pink-900/30 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {bookingTerms?.customText ? (
          <p className="text-[11px] text-[#9d7886] dark:text-[#d4aebc] leading-tight mb-3 px-1">
            {bookingTerms.customText}
          </p>
        ) : null}
        <div className="flex items-start gap-2 mb-4 px-1">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 rounded border-pink-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label className="text-[11px] text-[#9d7886] dark:text-[#d4aebc] leading-tight cursor-pointer select-none" htmlFor="terms">
            Я согласна с{' '}
            {bookingTerms?.termsOfServiceUrl ? (
              <a
                href={bookingTerms.termsOfServiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline"
                onClick={(e) => e.stopPropagation()}
              >
                Условиями обслуживания
              </a>
            ) : (
              <span className="text-primary font-medium">Условиями обслуживания</span>
            )}{' '}
            и{' '}
            {bookingTerms?.cancellationPolicyUrl ? (
              <a
                href={bookingTerms.cancellationPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline"
                onClick={(e) => e.stopPropagation()}
              >
                Политикой отмены
              </a>
            ) : (
              <span className="text-primary font-medium">Политикой отмены</span>
            )}
            .
          </label>
        </div>
        <button
          type="button"
          onClick={handlePayAndBook}
          disabled={!termsAccepted || createMutation.isPending}
          className="w-full bg-primary hover:brightness-105 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/30 flex justify-between px-6 items-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span className="text-lg">Записаться</span>
          <span className="text-lg">{totalPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽</span>
        </button>
      </footer>
    </div>
  );
}
