import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../shared/api/appointments';
import { servicesApi } from '../../shared/api/services';
import { apiClient } from '../../shared/api/client';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildCalendarDays(viewMonth: Date, selectedDate: Date) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // ПН = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());
  const selectedDay = startOfDay(selectedDate);
  const days: { date: Date; isCurrentMonth: boolean; isPast: boolean; isSelected: boolean; dayNum: number }[] = [];
  // Предыдущий месяц
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    days.push({
      date: d,
      isCurrentMonth: false,
      isPast: true,
      isSelected: false,
      dayNum: d.getDate(),
    });
  }
  // Текущий месяц
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const isPast = d < today;
    days.push({
      date: d,
      isCurrentMonth: true,
      isPast,
      isSelected: startOfDay(d).getTime() === selectedDay.getTime(),
      dayNum: day,
    });
  }
  // Следующий месяц до 42 ячеек (будущие даты можно выбирать — переключится месяц)
  let nextDay = 1;
  while (days.length < 42) {
    const d = new Date(year, month + 1, nextDay);
    const isPast = d < today;
    days.push({
      date: d,
      isCurrentMonth: false,
      isPast,
      isSelected: startOfDay(d).getTime() === selectedDay.getTime(),
      dayNum: nextDay,
    });
    nextDay++;
  }
  return days;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export default function CalendarPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { webApp, hapticFeedback } = useTelegram();
  const masterId = searchParams.get('masterId');
  const serviceId = searchParams.get('serviceId');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useTelegramBackButton();

  // Не показываем MainButton Telegram — используем только свою кнопку «Продолжить» в футере
  useEffect(() => {
    if (webApp?.MainButton) webApp.MainButton.hide();
  }, [webApp]);

  const { data: slots, isLoading, error } = useQuery({
    queryKey: ['slots', masterId, serviceId, selectedDate],
    queryFn: () =>
      appointmentsApi.getAvailableSlots(masterId!, serviceId!, selectedDate),
    enabled: !!masterId && !!serviceId,
    retry: 1,
  });

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

  const calendarDays = useMemo(
    () => buildCalendarDays(viewMonth, selectedDate),
    [viewMonth, selectedDate],
  );

  const handlePrevMonth = () => {
    hapticFeedback.selectionChanged();
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1));
  };

  const handleNextMonth = () => {
    hapticFeedback.selectionChanged();
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1));
  };

  const handleSelectDate = (day: (typeof calendarDays)[0]) => {
    if (day.isPast) return;
    hapticFeedback.selectionChanged();
    setSelectedDate(day.date);
    setSelectedSlot(null);
    // При выборе даты из следующего месяца — переключаем отображаемый месяц
    if (!day.isCurrentMonth) {
      setViewMonth(new Date(day.date.getFullYear(), day.date.getMonth()));
    }
  };

  const handleNext = () => {
    if (selectedSlot && masterId && serviceId) {
      hapticFeedback.impactOccurred('medium');
      navigate(
        `/confirm?masterId=${masterId}&serviceId=${serviceId}&startTime=${selectedSlot}`,
      );
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const monthStr = monthLabel(viewMonth);
  const monthTitle = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#2D1B22] dark:text-pink-50">
      {/* Единый стиль с этапами 1 и 2 */}
      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center p-4 justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-[#2D1B22] shadow-sm"
          >
            <span className="material-symbols-outlined text-[#2D1B22] dark:text-pink-100">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-[#2D1B22] dark:text-white text-lg font-bold leading-tight tracking-tight">Выбор даты и времени</h2>
          </div>
          <div className="size-10" />
        </div>
        <StepIndicator currentStep={3} />
      </header>

      <main className="pb-32">
        <section className="px-4 pt-2 pb-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center p-1 justify-between mb-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-full p-2 transition-colors text-primary"
              >
                <span className="material-symbols-outlined text-xl">chevron_left</span>
              </button>
              <p className="text-[#2D1B22] dark:text-white text-base font-bold leading-tight flex-1 text-center uppercase tracking-wide">
                {monthTitle}
              </p>
              <button
                type="button"
                onClick={handleNextMonth}
                className="hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-full p-2 transition-colors text-primary"
              >
                <span className="material-symbols-outlined text-xl">chevron_right</span>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS.map((wd) => (
                <p
                  key={wd}
                  className="text-pink-400 dark:text-pink-300 text-[11px] font-bold leading-normal flex h-5 w-full items-center justify-center"
                >
                  {wd}
                </p>
              ))}
              {calendarDays.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={day.isPast}
                  onClick={() => handleSelectDate(day)}
                  className={`h-8 w-full text-sm font-medium rounded-full transition-colors ${
                    day.isPast
                      ? 'text-gray-300 dark:text-gray-600 cursor-default'
                      : 'text-[#2D1B22] dark:text-white hover:bg-pink-50 dark:hover:bg-pink-900/20'
                  } ${day.isSelected ? 'cursor-default' : ''}`}
                >
                  <div className="flex size-full items-center justify-center">
                    {day.isSelected ? (
                      <span className="flex size-7 mx-auto items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 ring-2 ring-primary/20">
                        {day.dayNum}
                      </span>
                    ) : (
                      day.dayNum
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="h-2 bg-pink-50/50 dark:bg-pink-950/30" />

        <section className="px-4">
          <h3 className="text-[#2D1B22] dark:text-white text-lg font-bold leading-tight tracking-tight pb-2 pt-4">
            Доступное время
          </h3>
          {error ? (
            <div className="px-4 pb-6 text-center py-6">
              <p className="text-sm text-destructive mb-2">Ошибка загрузки доступного времени</p>
              <p className="text-xs text-muted-foreground">
                {error instanceof Error ? error.message : 'Попробуйте выбрать другую дату'}
              </p>
            </div>
          ) : slots && slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-3 p-4">
              {slots.map((slot: string) => {
                const time = new Date(slot).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      hapticFeedback.selectionChanged();
                      setSelectedSlot(slot);
                    }}
                    className={`flex h-11 items-center justify-center rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-2 ring-primary/20 border-transparent'
                        : 'bg-pink-50/50 dark:bg-gray-800 border-transparent hover:border-primary/50 text-[#2D1B22] dark:text-white'
                    }`}
                  >
                    <p className={isSelected ? 'text-sm font-bold' : 'text-sm font-medium'}>
                      {time}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 pb-6 text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">На эту дату нет доступного времени</p>
              <p className="text-xs text-muted-foreground">
                Выберите другую дату или проверьте расписание мастера
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Футер — как на этапе 2 (выбор мастера) */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 max-w-[430px] mx-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white/90 dark:bg-[#1f1214]/90 backdrop-blur-md border-t border-pink-100 dark:border-pink-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-pink-400 dark:text-pink-300 uppercase tracking-widest font-bold">
              Детали записи
            </span>
            <p className="text-[#2D1B22] dark:text-white text-sm font-bold">
              {service && master
                ? `${service.name} • ${master.name}`
                : '—'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-pink-400 dark:text-pink-300 uppercase tracking-widest font-bold">
              Итого
            </span>
            <p className="text-primary text-xl font-black leading-none">
              {service ? `${Number(service.price).toLocaleString('ru-RU')} ₽` : '—'}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!selectedSlot}
          onClick={handleNext}
          className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-pink-200/50 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          Продолжить
        </button>
      </footer>
    </div>
  );
}
