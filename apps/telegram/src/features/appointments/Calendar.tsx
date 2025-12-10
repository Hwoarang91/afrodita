import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../shared/api/appointments';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';

export default function CalendarPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { webApp, hapticFeedback } = useTelegram();
  const masterId = searchParams.get('masterId');
  const serviceId = searchParams.get('serviceId');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();
  
  // Настройка MainButton при выборе времени
  useEffect(() => {
    if (!webApp?.MainButton) return;
    
    const mainButton = webApp.MainButton;
    
    if (selectedSlot) {
      mainButton.setText('Продолжить');
      mainButton.show();
      
      const handleMainButtonClick = () => {
        hapticFeedback.impactOccurred('medium');
        handleNext();
      };
      
      mainButton.onClick(handleMainButtonClick);
      
      return () => {
        mainButton.offClick(handleMainButtonClick);
        mainButton.hide();
      };
    } else {
      mainButton.hide();
    }
  }, [selectedSlot, webApp, hapticFeedback]);

  const { data: slots, isLoading, error } = useQuery({
    queryKey: ['slots', masterId, serviceId, selectedDate],
    queryFn: () =>
      appointmentsApi.getAvailableSlots(masterId!, serviceId!, selectedDate),
    enabled: !!masterId && !!serviceId,
    retry: 1,
  });

  // Логирование ошибок для отладки
  if (error) {
    console.error('Ошибка загрузки слотов:', error);
  }

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

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">Выберите время</h1>
        <div className="bg-card rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-6 border border-border">
          <Calendar
            onChange={(date) => {
              hapticFeedback.selectionChanged();
              setSelectedDate(date as Date);
              setSelectedSlot(null); // Сбрасываем выбранный слот при изменении даты
            }}
            value={selectedDate}
            minDate={new Date()}
          />
        </div>
        <div className="bg-card rounded-lg shadow-md p-3 sm:p-6 border border-border">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
            Доступное время
          </h2>
          {error ? (
            <div className="text-center py-6 sm:py-8">
              <p className="text-sm sm:text-base text-destructive mb-2">Ошибка загрузки доступного времени</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Попробуйте выбрать другую дату'}
              </p>
            </div>
          ) : slots && slots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map((slot: string) => {
                const time = new Date(slot).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      hapticFeedback.selectionChanged();
                      setSelectedSlot(slot);
                    }}
                    className={`py-2.5 sm:py-2 px-3 sm:px-4 rounded-lg font-semibold text-sm sm:text-base transition ${
                      selectedSlot === slot
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <p className="text-sm sm:text-base text-muted-foreground mb-2">На эту дату нет доступного времени</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Выберите другую дату или проверьте расписание мастера
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

