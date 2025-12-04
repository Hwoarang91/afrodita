'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  master: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  appointment: Appointment;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [actionMenu, setActionMenu] = useState<{ x: number; y: number; appointment: Appointment } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'confirm' | 'cancel' | 'delete' | 'reschedule' | null;
    appointmentId: string | null;
    message: string;
    newStart?: Date;
  }>({
    open: false,
    type: null,
    appointmentId: null,
    message: '',
  });
  const queryClient = useQueryClient();

  // Получаем диапазон дат для загрузки записей
  const getDateRange = () => {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { locale: ru });
      const end = endOfWeek(currentDate, { locale: ru });
      return { start, end };
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start, end };
    }
  };

  const { start, end } = getDateRange();

  // Загружаем рабочие часы из настроек
  const { data: workingHoursData } = useQuery({
    queryKey: ['working-hours'],
    queryFn: async () => {
      const { data } = await apiClient.get('/settings/working-hours');
      return data?.value || { start: '09:00', end: '21:00' };
    },
  });

  const workingHours = workingHoursData || { start: '09:00', end: '21:00' };

  // Генерируем массив часов на основе рабочих часов
  const generateHours = () => {
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);
    const hours: number[] = [];
    
    // Начальный час всегда включаем
    let currentHour = startHour;
    
    // Конечный час включаем, если есть минуты или если он больше начального
    const lastHour = endMinute > 0 ? endHour : endHour - 1;
    
    // Генерируем часы от начального до конечного включительно
    while (currentHour <= lastHour) {
      hours.push(currentHour);
      currentHour++;
    }
    
    return hours.length > 0 ? hours : [startHour];
  };

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['appointments-calendar', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/appointments', {
          params: {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
          },
        });
        return data || [];
      } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Calendar] Ошибка при загрузке записей:', error);
        }
        throw error;
      }
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, startTime }: { id: string; startTime: string }) => {
      await apiClient.patch(`/appointments/${id}`, { startTime });
    },
    onMutate: async ({ id, startTime }) => {
      const queryKey = ['appointments-calendar', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')];
      await queryClient.cancelQueries({ queryKey });
      const previousAppointments = queryClient.getQueryData(queryKey);
      
      // Обновляем время сразу в UI
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === id ? { ...apt, startTime: new Date(startTime) } : apt
        );
      });
      
      return { previousAppointments, queryKey };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousAppointments);
      }
      toast.error(`Ошибка: ${error.response?.data?.message || error.message}`);
    },
    onSuccess: () => {
      toast.success('Запись перенесена. Клиенту отправлено уведомление.');
      setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/appointments/${id}/confirm`);
    },
    onMutate: async (id) => {
      const queryKey = ['appointments-calendar', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')];
      await queryClient.cancelQueries({ queryKey });
      const previousAppointments = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === id ? { ...apt, status: 'confirmed' } : apt
        );
      });
      
      return { previousAppointments, queryKey };
    },
    onError: (error: any, id, context) => {
      if (context?.previousAppointments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousAppointments);
      }
      toast.error(`Ошибка: ${error.response?.data?.message || error.message}`);
    },
    onSuccess: () => {
      setSelectedAppointment(null);
      toast.success('Запись подтверждена. Клиенту отправлено уведомление.');
      setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await apiClient.post(`/appointments/${id}/cancel-admin`, { reason });
    },
    onMutate: async ({ id }) => {
      const queryKey = ['appointments-calendar', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')];
      await queryClient.cancelQueries({ queryKey });
      const previousAppointments = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === id ? { ...apt, status: 'cancelled' } : apt
        );
      });
      
      return { previousAppointments, queryKey };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousAppointments);
      }
      toast.error(`Ошибка: ${error.response?.data?.message || error.message}`);
    },
    onSuccess: () => {
      setSelectedAppointment(null);
      toast.success('Запись отменена. Клиенту отправлено уведомление.');
      setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/appointments/${id}/delete`);
    },
    onMutate: async (id) => {
      const queryKey = ['appointments-calendar', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')];
      await queryClient.cancelQueries({ queryKey });
      const previousAppointments = queryClient.getQueryData(queryKey);
      
      // Удаляем из списка сразу
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.filter((apt: Appointment) => apt.id !== id);
      });
      
      return { previousAppointments, queryKey };
    },
    onError: (error: any, id, context) => {
      if (context?.previousAppointments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousAppointments);
      }
      toast.error(`Ошибка: ${error.response?.data?.message || error.message}`);
    },
    onSuccess: () => {
      setSelectedAppointment(null);
      toast.success('Запись удалена');
      setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });

  // Преобразуем записи в события календаря
  const events: CalendarEvent[] =
    appointments?.map((apt: Appointment) => {
      const startDate = new Date(apt.startTime);
      const endDate = new Date(apt.endTime);
      return {
        id: apt.id,
        title: `${apt.client.firstName} ${apt.client.lastName} - ${apt.service.name}`,
        start: startDate,
        end: endDate,
        appointment: apt,
      };
    }) || [];


  // Обработка drag & drop
  const handleEventDrop = useCallback(
    (event: CalendarEvent, newStart: Date) => {
      setConfirmDialog({
        open: true,
        type: 'reschedule',
        appointmentId: event.id,
        message: `Перенести запись на ${format(newStart, 'dd.MM.yyyy HH:mm', { locale: ru })}?`,
        newStart,
      });
    },
    [],
  );

  const handleConfirmAction = () => {
    if (!confirmDialog.appointmentId) return;

    switch (confirmDialog.type) {
      case 'reschedule':
        if (confirmDialog.newStart) {
          updateAppointmentMutation.mutate({
            id: confirmDialog.appointmentId,
            startTime: confirmDialog.newStart.toISOString(),
          });
        }
        break;
      case 'confirm':
        confirmMutation.mutate(confirmDialog.appointmentId);
        break;
      case 'cancel':
        cancelMutation.mutate({ id: confirmDialog.appointmentId });
        break;
      case 'delete':
        deleteMutation.mutate(confirmDialog.appointmentId);
        break;
    }
  };

  // Обработка клика по событию
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(event.appointment);
  };

  // Обработка правого клика (контекстное меню)
  const handleContextMenu = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    setActionMenu({
      x: e.clientX,
      y: e.clientY,
      appointment: event.appointment,
    });
  };

  if (isLoading) {
    return <div className="p-8">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600 dark:text-red-400">
          Ошибка при загрузке записей: {(error as Error).message}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Проверьте консоль браузера для подробностей.
        </div>
      </div>
    );
  }

  // Рендерим недельный вид
  if (view === 'week') {
    const weekDays = eachDayOfInterval({ start, end });
    const hours = generateHours();

    return (
      <div className="p-8">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-foreground">Календарь записей</h1>
              <div className="flex gap-2">
                <Button
                  onClick={() => setView('week')}
                  variant={view === 'week' ? 'default' : 'outline'}
                >
                  Неделя
                </Button>
                <Button
                  onClick={() => setView('month')}
                  variant={view === 'month' ? 'default' : 'outline'}
                >
                  Месяц
                </Button>
              </div>
            </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentDate(subDays(currentDate, view === 'week' ? 7 : 30))}
              variant="outline"
              size="icon"
            >
              ←
            </Button>
            <span className="px-4 py-2 font-semibold">
              {format(currentDate, 'MMMM yyyy', { locale: ru })}
            </span>
            <Button
              onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? 7 : 30))}
              variant="outline"
              size="icon"
            >
              →
            </Button>
            <Button
              onClick={() => setCurrentDate(new Date())}
              variant="default"
            >
              Сегодня
            </Button>
          </div>
          </div>
          
          {/* Легенда цветов статусов и отладочная информация */}
          <div className="space-y-4">
            <div className="bg-card rounded-lg shadow p-4 border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Цвета статусов записей:</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30"></div>
                  <span className="text-xs text-foreground">Подтверждена</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/30"></div>
                  <span className="text-xs text-foreground">Не подтверждена</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/30"></div>
                  <span className="text-xs text-foreground">Отменена</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-purple-300 dark:border-purple-700 bg-purple-100 dark:bg-purple-900/30"></div>
                  <span className="text-xs text-foreground">Перенесена</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/30"></div>
                  <span className="text-xs text-foreground">Завершена</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow overflow-hidden transition-colors">
          <div className="grid grid-cols-8 border-b border-border">
            <div className="p-2 border-r border-border font-semibold text-foreground">Время</div>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="p-2 border-r border-border text-center">
                <div className="font-semibold text-foreground">{format(day, 'EEE', { locale: ru })}</div>
                <div className="text-sm text-muted-foreground">{format(day, 'd MMM', { locale: ru })}</div>
              </div>
            ))}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border">
                <div className="p-2 border-r border-border text-sm text-muted-foreground">{hour}:00</div>
                {weekDays.map((day) => {
                  // Фильтруем события для этого дня и часа
                  // Событие отображается в ячейке часа, если оно начинается в этом часе
                  const dayEvents = events.filter((e) => {
                    const isSameDayCheck = isSameDay(e.start, day);
                    if (!isSameDayCheck) return false;
                    
                    // Событие отображается в ячейке часа, если оно начинается в этом часе
                    const eventStartHour = e.start.getHours();
                    const hourCheck = eventStartHour === hour;
                    
                    
                    return hourCheck;
                  });
                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="p-1 border-r border-border min-h-[60px] relative bg-muted/30"
                      onDrop={(e) => {
                        e.preventDefault();
                        const eventId = e.dataTransfer.getData('eventId');
                        const event = events.find((ev) => ev.id === eventId);
                        if (event) {
                          const newStart = new Date(day);
                          newStart.setHours(hour, 0, 0, 0);
                          handleEventDrop(event, newStart);
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('eventId', event.id);
                          }}
                          onClick={(e) => handleEventClick(event, e)}
                          onContextMenu={(e) => handleContextMenu(event, e)}
                          className={`mb-1 p-1 rounded text-xs cursor-move ${
                            event.appointment.status === 'confirmed'
                              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-foreground'
                              : event.appointment.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-foreground'
                              : event.appointment.status === 'cancelled'
                              ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-foreground'
                              : event.appointment.status === 'rescheduled'
                              ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 text-foreground'
                              : 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-foreground'
                          }`}
                        >
                          <div className="font-semibold truncate">{format(event.start, 'HH:mm')}</div>
                          <div className="truncate">{event.appointment.client.firstName}</div>
                          <div className="truncate text-muted-foreground">{event.appointment.service.name}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Модальное окно с деталями записи */}
        {selectedAppointment && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 max-w-md w-full shadow-xl transition-colors">
              <h2 className="text-2xl font-bold mb-4 text-foreground">Детали записи</h2>
              <div className="space-y-2 mb-4 text-foreground">
                <p>
                  <span className="font-semibold">Клиент:</span> {selectedAppointment.client.firstName}{' '}
                  {selectedAppointment.client.lastName}
                </p>
                <p>
                  <span className="font-semibold">Телефон:</span>{' '}
                  {selectedAppointment.client.phone || 'Не указан'}
                </p>
                <p>
                  <span className="font-semibold">Мастер:</span> {selectedAppointment.master.name}
                </p>
                <p>
                  <span className="font-semibold">Услуга:</span> {selectedAppointment.service.name}
                </p>
                <p>
                  <span className="font-semibold">Время:</span>{' '}
                  {format(new Date(selectedAppointment.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })}
                </p>
                <p>
                  <span className="font-semibold">Цена:</span> {selectedAppointment.price} ₽
                </p>
                <p>
                  <span className="font-semibold">Статус:</span>{' '}
                  {selectedAppointment.status === 'confirmed'
                    ? 'Подтверждена'
                    : selectedAppointment.status === 'pending'
                    ? 'Не подтверждена'
                    : selectedAppointment.status === 'cancelled'
                    ? 'Отменена'
                    : 'Завершена'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedAppointment.status === 'pending' && (
                  <Button
                    onClick={() => {
                      setConfirmDialog({
                        open: true,
                        type: 'confirm',
                        appointmentId: selectedAppointment.id,
                        message: 'Подтвердить запись?',
                      });
                    }}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Подтвердить
                  </Button>
                )}
                {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                  <Button
                    onClick={() => {
                      setConfirmDialog({
                        open: true,
                        type: 'cancel',
                        appointmentId: selectedAppointment.id,
                        message: 'Отменить запись?',
                      });
                    }}
                    variant="default"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Отменить
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      type: 'delete',
                      appointmentId: selectedAppointment.id,
                      message: 'Удалить запись? Это действие нельзя отменить.',
                    });
                  }}
                  variant="destructive"
                >
                  Удалить
                </Button>
                <Button
                  onClick={() => setSelectedAppointment(null)}
                  variant="outline"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Контекстное меню */}
        {actionMenu && (
          <div
            className="fixed bg-background border border-border rounded-lg shadow-lg z-50"
            style={{ left: actionMenu.x, top: actionMenu.y }}
          >
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setSelectedAppointment(actionMenu.appointment);
                setActionMenu(null);
              }}
            >
              Открыть детали
            </Button>
            {actionMenu.appointment.status === 'pending' && (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  confirmMutation.mutate(actionMenu.appointment.id);
                  setActionMenu(null);
                }}
              >
                Подтвердить
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => {
                setConfirmDialog({
                  open: true,
                  type: 'delete',
                  appointmentId: actionMenu.appointment.id,
                  message: 'Удалить запись?',
                });
                setActionMenu(null);
              }}
            >
              Удалить
            </Button>
          </div>
        )}

        {/* Диалог подтверждения */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Подтвердите действие</DialogTitle>
              <DialogDescription>{confirmDialog.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDialog({ open: false, type: null, appointmentId: null, message: '' });
                }}
              >
                Отмена
              </Button>
              <Button
                variant={confirmDialog.type === 'delete' ? 'destructive' : 'default'}
                onClick={handleConfirmAction}
              >
                Подтвердить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Месячный вид (упрощенный)
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Календарь записей</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCurrentDate(subDays(currentDate, 30))}
            variant="outline"
            size="icon"
          >
            ←
          </Button>
          <span className="px-4 py-2 font-semibold text-foreground">
            {format(currentDate, 'MMMM yyyy', { locale: ru })}
          </span>
          <Button
            onClick={() => setCurrentDate(addDays(currentDate, 30))}
            variant="outline"
            size="icon"
          >
            →
          </Button>
        </div>
      </div>
      <div className="text-center text-muted-foreground">
        Месячный вид в разработке. Используйте недельный вид.
      </div>
    </div>
  );
}

