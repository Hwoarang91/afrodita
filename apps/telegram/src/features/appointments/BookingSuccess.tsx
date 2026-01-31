import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { appointmentsApi } from '../../shared/api/appointments';
import { getBusiness } from '../../shared/api/settings';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { useTelegram } from '../../contexts/TelegramContext';
import type { Appointment } from '@shared/types';

function formatDateRu(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' });
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Короткий номер записи из id (первые 8 символов в верхнем регистре). */
function recordNumber(id: string) {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Ссылка для открытия адреса в навигаторе (Google Maps). */
function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function BookingSuccess() {
  const navigate = useNavigate();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { webApp, hapticFeedback } = useTelegram();

  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
    return () => { if (webApp?.MainButton) webApp.MainButton.hide(); };
  }, [webApp]);

  const { data: appointment, isLoading: appointmentLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentsApi.getById(appointmentId!),
    enabled: !!appointmentId,
  });

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: getBusiness,
  });

  useEffect(() => {
    if (!appointmentId) {
      navigate('/profile');
    }
  }, [appointmentId, navigate]);

  if (!appointmentId || appointmentLoading || !appointment) {
    return <LoadingSpinner />;
  }

  const apt = appointment as Appointment & { service?: { name: string; duration: number; imageUrl?: string }; master?: { name: string }; extraServices?: Array<{ name: string }> };
  const serviceName = apt.service?.name ?? '—';
  const duration = apt.service?.duration ?? 0;
  const masterName = apt.master?.name ?? '—';
  const extraNames = apt.extraServices?.map((e: { name: string }) => e.name).join(', ') || '—';
  const address = business?.address?.trim() || '—';
  const price = Number(apt.price) || 0;
  const recordNum = recordNumber(apt.id);

  const handleClose = () => {
    hapticFeedback.impactOccurred('light');
    navigate('/profile');
  };

  const handleToMyBookings = () => {
    hapticFeedback.impactOccurred('light');
    navigate('/history');
  };

  const handleRoute = () => {
    hapticFeedback.impactOccurred('light');
    if (business?.address?.trim()) {
      window.open(mapsUrl(business.address), '_blank', 'noopener,noreferrer');
    }
  };

  const handleToHome = () => {
    hapticFeedback.impactOccurred('light');
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] shadow-xl relative">
      {/* Шапка */}
      <header className="flex items-center justify-between p-4 pb-2 sticky top-0 z-10 bg-[#fff9fa] dark:bg-background-dark border-b border-pink-100 dark:border-pink-900/30">
        <div className="text-primary flex size-12 shrink-0 items-center justify-center">
          <span className="material-symbols-outlined text-3xl">spa</span>
        </div>
        <h2 className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-bold leading-tight tracking-tight flex-1 text-center">
          Готово
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-900/30 text-[#3d2b31] dark:text-[#fce7f3]"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      {/* Иконка и заголовок */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
          <div className="relative bg-primary text-white rounded-full p-6 shadow-xl shadow-primary/30 animate-pulse">
            <span className="material-symbols-outlined text-6xl">check_circle</span>
          </div>
        </div>
        <h1 className="text-[#3d2b31] dark:text-[#fce7f3] tracking-tight text-2xl font-bold leading-tight px-4 pb-2 pt-10 text-center">
          Запись подтверждена!
        </h1>
        <p className="text-[#9d7886] dark:text-[#d4aebc] text-base font-normal leading-normal pb-6 px-6 text-center">
          Ваша процедура успешно забронирована.
        </p>
      </div>

      {/* Карточка с деталями */}
      <div className="px-4 flex-1">
        <div className="flex flex-col rounded-2xl border border-pink-100 dark:border-pink-900/30 bg-white dark:bg-[#3d242f]/50 overflow-hidden shadow-sm">
          {apt.service?.imageUrl ? (
            <div
              className="w-full bg-center bg-no-repeat aspect-video bg-cover"
              style={{ backgroundImage: `url("${apt.service.imageUrl}")` }}
            />
          ) : null}
          <div className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-xl font-bold leading-tight tracking-tight">
                {serviceName}
              </p>
              <p className="text-primary text-sm font-semibold mt-1 uppercase tracking-wider">
                {duration} минут
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Запись и номер записи */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">confirmation_number</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Запись</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">№ {recordNum}</p>
                </div>
              </div>
              {/* Специалист */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Специалист</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">{masterName}</p>
                </div>
              </div>
              {/* Услуга */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">spa</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Услуга</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">{serviceName}</p>
                </div>
              </div>
              {/* Доп. услуга */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Доп. услуга</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">{extraNames}</p>
                </div>
              </div>
              {/* Дата и время */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">calendar_today</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Дата и время</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">
                    {formatDateRu(apt.startTime)}, {formatTime(apt.startTime)}
                  </p>
                </div>
              </div>
              {/* Адрес */}
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary mt-0.5">
                  <span className="material-symbols-outlined text-xl">location_on</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Адрес салона</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold whitespace-pre-line">{address}</p>
                </div>
              </div>
              {/* Цена */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fdf2f8] dark:bg-pink-900/30 text-primary">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <p className="text-[#9d7886] dark:text-[#d4aebc] text-xs">Цена</p>
                  <p className="text-[#3d2b31] dark:text-[#fce7f3] text-sm font-bold">
                    {price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки К моим записям и Маршрут */}
      <div className="flex justify-center mt-6 px-4">
        <div className="flex flex-1 gap-3 w-full max-w-[430px]">
          <button
            type="button"
            onClick={handleToMyBookings}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl h-12 px-4 bg-[#fdf2f8] dark:bg-pink-900/20 text-primary border border-pink-100 dark:border-pink-900/30 text-sm font-bold tracking-wide transition-colors"
          >
            <span className="material-symbols-outlined text-lg">event</span>
            <span className="truncate">К моим записям</span>
          </button>
          <button
            type="button"
            onClick={handleRoute}
            disabled={!business?.address?.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl h-12 px-4 bg-[#fdf2f8] dark:bg-pink-900/20 text-primary border border-pink-100 dark:border-pink-900/30 text-sm font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">near_me</span>
            <span className="truncate">Маршрут</span>
          </button>
        </div>
      </div>

      {/* На главную */}
      <div className="mt-auto px-4 pb-10 pt-4">
        <button
          type="button"
          onClick={handleToHome}
          className="flex w-full items-center justify-center rounded-2xl h-14 bg-primary text-white text-base font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.98] transition-all"
        >
          На главную
        </button>
      </div>

      <div className="h-6 w-full flex justify-center items-end pb-2">
        <div className="w-32 h-1 bg-pink-200 dark:bg-pink-900/40 rounded-full" />
      </div>
    </div>
  );
}
