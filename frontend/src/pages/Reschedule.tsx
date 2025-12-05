import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../api/appointments';
import LoadingSpinner from '../components/LoadingSpinner';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Reschedule() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: appointment, isLoading: appointmentLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsApi.getById(id!),
    enabled: !!id,
  });

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', appointment?.masterId, appointment?.serviceId, selectedDate?.toISOString()],
    queryFn: () => {
      if (!appointment || !selectedDate) return [];
      return appointmentsApi.getAvailableSlots(
        appointment.masterId,
        appointment.serviceId,
        selectedDate,
      );
    },
    enabled: !!appointment && !!selectedDate,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (newStartTime: string) => {
      if (!id) throw new Error('Appointment ID is required');
      return appointmentsApi.reschedule(id, newStartTime);
    },
    onMutate: async (newStartTime) => {
      await queryClient.cancelQueries({ queryKey: ['appointment', id] });
      const previousAppointment = queryClient.getQueryData(['appointment', id]);
      
      // Оптимистично обновляем время записи
      queryClient.setQueryData(['appointment', id], (old: any) => {
        if (!old) return old;
        return { ...old, startTime: newStartTime };
      });
      
      return { previousAppointment };
    },
    onError: (error: any, variables, context) => {
      // Откатываем изменения при ошибке
      if (context?.previousAppointment) {
        queryClient.setQueryData(['appointment', id], context.previousAppointment);
      }
      toast.error(error.response?.data?.message || 'Ошибка при переносе записи');
    },
    onSuccess: () => {
      toast.success('Запись успешно перенесена!');
      navigate('/profile');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  if (appointmentLoading) {
    return <LoadingSpinner />;
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Запись не найдена</p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg"
          >
            Вернуться в профиль
          </button>
        </div>
      </div>
    );
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (!selectedTime) {
      toast.error('Выберите время');
      return;
    }
    rescheduleMutation.mutate(selectedTime);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Перенос записи</h1>

        <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Текущая запись</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Услуга:</span> {appointment.service?.name}
            </p>
            <p>
              <span className="font-semibold text-foreground">Мастер:</span> {appointment.master?.name}
            </p>
            <p>
              <span className="font-semibold text-foreground">Дата и время:</span>{' '}
              {format(new Date(appointment.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
            </p>
            <p>
              <span className="font-semibold text-foreground">Цена:</span> {appointment.price} ₽
            </p>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Выберите новую дату</h2>
          <Calendar
            onChange={(value) => {
              if (value instanceof Date) {
                setSelectedDate(value);
                setSelectedTime(null);
              }
            }}
            value={selectedDate}
            minDate={new Date()}
            locale="ru"
            className="w-full"
          />
        </div>

        {selectedDate && (
          <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Выберите время</h2>
            {slotsLoading ? (
              <LoadingSpinner />
            ) : slots && slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot: string) => {
                  const slotDate = new Date(slot);
                  const timeStr = format(slotDate, 'HH:mm');
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => handleTimeSelect(slot)}
                      className={`py-3 px-4 rounded-lg font-semibold transition ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                На выбранную дату нет свободных слотов
              </p>
            )}
          </div>
        )}

        {selectedTime && (
          <div className="bg-card rounded-lg shadow-md p-6 mb-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Подтверждение</h2>
            <div className="space-y-2 text-muted-foreground mb-4">
              <p>
                <span className="font-semibold text-foreground">Новая дата и время:</span>{' '}
                {format(new Date(selectedTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleConfirm}
                disabled={rescheduleMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Перенос...' : 'Подтвердить перенос'}
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-lg font-semibold hover:bg-secondary/80 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

