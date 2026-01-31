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
      {/* Заголовок с галочкой */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-4xl" aria-hidden>check_circle</span>
          <h1 className="text-[#3d2b31] dark:text-[#fce7f3] tracking-tight text-2xl font-bold leading-tight text-center">
            Запись подтверждена!
          </h1>
        </div>
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

      {/* Кнопки В календарь и Маршрут */}
      <div className="flex justify-center mt-6 px-4">
        <div className="flex flex-1 gap-3 w-full max-w-[430px]">
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticFeedback.impactOccurred('light')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl h-12 px-4 bg-[#fdf2f8] dark:bg-pink-900/20 text-primary border border-pink-100 dark:border-pink-900/30 text-sm font-bold tracking-wide transition-colors no-underline"
          >
            <span className="material-symbols-outlined text-lg">event</span>
            <span className="truncate">В календарь</span>
          </a>
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
