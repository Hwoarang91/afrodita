import { useNavigate, useParams, useLocation } from 'react-router-dom';
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

/** Формат даты для Google Calendar (UTC). */
function toGoogleCalendarDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

/** Ссылка «Добавить в календарь» (Google Calendar). */
function calendarAddUrl(params: { title: string; startTime: string; durationMin: number; details?: string; location?: string }) {
  const start = new Date(params.startTime);
  const end = new Date(start.getTime() + params.durationMin * 60 * 1000);
  const text = encodeURIComponent(params.title);
  const dates = `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`;
  const details = params.details ? encodeURIComponent(params.details) : '';
  const location = params.location ? encodeURIComponent(params.location) : '';
  const base = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}`;
  const parts = [base];
  if (details) parts.push(`details=${details}`);
  if (location) parts.push(`location=${location}`);
  return parts.join('&');
}

export default function BookingSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { webApp, hapticFeedback } = useTelegram();
  const appointmentFromState = (location.state as { appointment?: Appointment } | null)?.appointment;

  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
    return () => { if (webApp?.MainButton) webApp.MainButton.hide(); };
  }, [webApp]);

  const { data: appointmentFromApi, isLoading: appointmentLoading, isError: appointmentError } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentsApi.getById(appointmentId!),
    enabled: !!appointmentId && !appointmentFromState,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const appointment = appointmentFromState ?? appointmentFromApi;

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: getBusiness,
  });

  useEffect(() => {
    if (!appointmentId) {
      navigate('/profile');
    }
  }, [appointmentId, navigate]);

  if (!appointmentId) {
    return <LoadingSpinner />;
  }

  if (appointmentError) {
    return (
      <div className="flex flex-col min-h-screen max-w-[430px] mx-auto bg-[#fff9fa] dark:bg-background-dark text-[#3d2b31] dark:text-[#fce7f3] items-center justify-center p-6">
        <p className="text-center text-[#9d7886] dark:text-[#d4aebc] mb-4">Не удалось загрузить данные записи</p>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-full max-w-xs bg-primary text-white font-bold py-3 rounded-2xl"
        >
          В профиль
        </button>
      </div>
    );
  }

  if (appointmentLoading || !appointment) {
    return <LoadingSpinner />;
  }

  const apt = appointment as Appointment & { service?: { name: string; duration: number; imageUrl?: string }; master?: { name: string }; extraServices?: Array<{ name: string }> };
  const serviceName = apt.service?.name ?? '—';
  const duration = apt.service?.duration ?? 0;
  const masterName = apt.master?.name ?? '—';
  const extraNames = apt.extraServices?.length
    ? apt.extraServices.map((e: { name: string }) => e.name).join(', ')
    : 'Не выбрано';
  const address = business?.address?.trim() || '—';
  const price = Number(apt.price) || 0;
  const recordNum = recordNumber(apt.id);

  const calendarUrl = calendarAddUrl({
    title: serviceName,
    startTime: apt.startTime,
    durationMin: duration || 60,
    details: [`Запись № ${recordNum}`, `Специалист: ${masterName}`, extraNames !== 'Не выбрано' ? `Доп. услуги: ${extraNames}` : null].filter(Boolean).join('\n'),
    location: business?.address?.trim() || undefined,
  });

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
      <header className="sticky top-0 z-10 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-pink-100 dark:border-pink-900/30">
        <div className="flex items-center p-4 pb-2 justify-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>check_circle</span>
            <h2 className="text-[#3d2b31] dark:text-[#fce7f3] text-lg font-bold leading-tight tracking-tight">
              Запись подтверждена!
            </h2>
          </div>
        </div>
        <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm text-center px-4 pb-4">
          Ваша процедура успешно забронирована.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto pb-36">
        <h3 className="text-[#2d1b22] dark:text-[#fff0f5] text-lg font-bold px-4 pb-2 pt-4">Детали записи</h3>
        <div className="space-y-1 px-4">
          {/* Запись */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">confirmation_number</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">№ {recordNum}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Запись</p>
            </div>
          </div>
          {/* Специалист */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">person</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">{masterName}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Специалист</p>
            </div>
          </div>
          {/* Услуга */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">{serviceName}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">{duration} минут</p>
            </div>
          </div>
          {/* Доп. услуга */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">add_circle</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal truncate">{extraNames}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Доп. услуга</p>
            </div>
          </div>
          {/* Дата и время */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">calendar_today</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">{formatDateRu(apt.startTime)}, {formatTime(apt.startTime)}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Дата и время</p>
            </div>
          </div>
          {/* Адрес */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12 self-start mt-1">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1 py-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal whitespace-pre-line">{address}</p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Адрес салона</p>
            </div>
          </div>
          {/* Цена */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#3d242f] min-h-[72px] py-3 px-4 rounded-xl border border-pink-100/50 dark:border-pink-900/30">
            <div className="text-primary flex items-center justify-center rounded-xl bg-[#fdf2f8] dark:bg-[#5a3644] shrink-0 size-12">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[#3d2b31] dark:text-[#fce7f3] text-base font-semibold leading-normal">
                {price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
              </p>
              <p className="text-[#9d7886] dark:text-[#d4aebc] text-sm">Цена</p>
            </div>
          </div>
        </div>

        {/* Кнопки В календарь и Маршрут */}
        <div className="flex gap-3 px-4 mt-4">
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticFeedback.impactOccurred('light')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl h-12 px-4 bg-white dark:bg-[#3d242f] border border-pink-100/50 dark:border-pink-900/30 text-primary text-sm font-semibold transition-colors no-underline"
          >
            <span className="material-symbols-outlined text-lg">event</span>
            <span className="truncate">В календарь</span>
          </a>
          <button
            type="button"
            onClick={handleRoute}
            disabled={!business?.address?.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl h-12 px-4 bg-white dark:bg-[#3d242f] border border-pink-100/50 dark:border-pink-900/30 text-primary text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">near_me</span>
            <span className="truncate">Маршрут</span>
          </button>
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-4 bg-[#fff9fa]/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-pink-100 dark:border-pink-900/30 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleToHome}
          className="flex w-full items-center justify-center rounded-2xl h-14 bg-primary text-white text-base font-bold shadow-lg shadow-primary/30 hover:brightness-105 active:scale-[0.98] transition-all"
        >
          На главную
        </button>
      </footer>
    </div>
  );
}
