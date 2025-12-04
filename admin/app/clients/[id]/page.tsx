'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import TelegramIcon from '../../components/TelegramIcon';
import { Mail } from 'lucide-react';
import { VirtualizedList } from '@/app/components/VirtualizedList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderIntervals, setReminderIntervals] = useState<number[]>([24, 2]);
  const queryClient = useQueryClient();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${clientId}`);
      return data;
    },
  });

  // Инициализируем adminNotes при загрузке клиента
  useEffect(() => {
    if (client?.adminNotes) {
      setAdminNotes(client.adminNotes);
    }
  }, [client?.adminNotes]);

  // Инициализируем настройки уведомлений при загрузке клиента
  useEffect(() => {
    if (client?.notificationSettings) {
      setRemindersEnabled(client.notificationSettings.remindersEnabled !== false);
      setReminderIntervals(client.notificationSettings.reminderIntervals || [24, 2]);
    } else {
      setRemindersEnabled(true);
      setReminderIntervals([24, 2]);
    }
  }, [client?.notificationSettings]);

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/appointments`, {
        params: { clientId },
      });
      return data;
    },
  });

  const { data: interactionHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['client-interaction-history', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${clientId}/interaction-history`);
      return data || [];
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!client?.telegramId) {
        throw new Error('У клиента нет Telegram ID');
      }
      await apiClient.post('/telegram/send-message', {
        chatId: client.telegramId,
        message,
        parse_mode: 'HTML',
      });
    },
    onSuccess: () => {
      setShowMessageModal(false);
      setMessageText('');
      toast.success('Сообщение отправлено');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiClient.put(`/users/${clientId}`, { adminNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setShowNotesModal(false);
      toast.success('Комментарий сохранен');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const updateNotificationSettingsMutation = useMutation({
    mutationFn: async (settings: { remindersEnabled: boolean; reminderIntervals: number[] }) => {
      await apiClient.put(`/users/${clientId}`, {
        notificationSettings: {
          remindersEnabled: settings.remindersEnabled,
          reminderIntervals: settings.reminderIntervals,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setShowNotificationSettingsModal(false);
      toast.success('Настройки уведомлений сохранены');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  if (clientLoading) {
    return <div className="p-8">Загрузка...</div>;
  }

  return (
    <div className="p-8">
      <Link
        href="/clients"
        className="text-primary-600 hover:text-primary-800 mb-4 inline-block"
      >
        ← Назад к списку клиентов
      </Link>

      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 transition-colors">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {client?.firstName} {client?.lastName}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Контактная информация</h2>
            <div className="space-y-3 text-muted-foreground">
              <div>
                <span className="font-medium">Имя:</span>{' '}
                <span className="text-foreground">
                  {client?.firstName} {client?.lastName}
                </span>
              </div>
              <div>
                <span className="font-medium">Телефон:</span>{' '}
                {client?.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    {client.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground/70 italic">Не указан</span>
                )}
              </div>
              {client?.email && (
                <div>
                  <span className="font-medium">Email:</span>{' '}
                  <a
                    href={`mailto:${client.email}`}
                    className="text-primary hover:text-primary/80"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client?.telegramId && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Telegram:</span>
                  <span className="text-foreground">{client.telegramId}</span>
                  <div className="flex gap-2 ml-2">
                    <a
                      href={
                        client.username
                          ? `https://t.me/${client.username}`
                          : `tg://user?id=${client.telegramId}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:opacity-80 transition-opacity"
                      title="Открыть в Telegram"
                    >
                      <TelegramIcon />
                    </a>
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        setShowMessageModal(true);
                      }}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                      title="Отправить сообщение от имени бота"
                    >
                      <Mail className="w-10 h-10 text-[#29B6F6]" style={{ stroke: '#29B6F6' }} />
                    </a>
                  </div>
                </div>
              )}
              <div>
                <span className="font-medium">Бонусы:</span>{' '}
                <span className="text-foreground font-semibold">
                  {client?.bonusPoints || 0} баллов
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Статистика</h2>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <span className="font-medium">Всего записей:</span>{' '}
                <span className="text-foreground">{appointments?.length || 0}</span>
              </div>
              <div>
                <span className="font-medium">Дата регистрации:</span>{' '}
                <span className="text-foreground">
                  {client?.createdAt &&
                    format(new Date(client.createdAt), 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-md font-semibold text-foreground mb-2">Комментарий админа</h3>
              <div className="bg-muted/50 rounded-lg p-3 min-h-[100px]">
                {client?.adminNotes ? (
                  <p className="text-foreground whitespace-pre-wrap">{client.adminNotes}</p>
                ) : (
                  <p className="text-muted-foreground/70 italic">Нет комментариев</p>
                )}
              </div>
              <button
                onClick={() => {
                  setAdminNotes(client?.adminNotes || '');
                  setShowNotesModal(true);
                }}
                className="mt-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
              >
                {client?.adminNotes ? 'Редактировать' : 'Добавить'} комментарий
              </button>
            </div>
            <div className="mt-6">
              <h3 className="text-md font-semibold text-foreground mb-2">Настройки уведомлений</h3>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Напоминания о записях:</span>
                    <span className={`font-medium ${client?.notificationSettings?.remindersEnabled !== false ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {client?.notificationSettings?.remindersEnabled !== false ? 'Включены' : 'Отключены'}
                    </span>
                  </div>
                  {client?.notificationSettings?.reminderIntervals && client.notificationSettings.reminderIntervals.length > 0 ? (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Интервалы:</span>{' '}
                      {client.notificationSettings.reminderIntervals
                        .sort((a, b) => b - a)
                        .map((h) => `${h}ч`)
                        .join(', ')}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Интервалы:</span> Используются глобальные настройки
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setRemindersEnabled(client?.notificationSettings?.remindersEnabled !== false);
                  setReminderIntervals(client?.notificationSettings?.reminderIntervals || [24, 2]);
                  setShowNotificationSettingsModal(true);
                }}
                className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
              >
                Редактировать настройки
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* История взаимодействий */}
      <div className="bg-card rounded-lg shadow p-6 mb-6 transition-colors">
        <h2 className="text-xl font-semibold text-foreground mb-4">История взаимодействий</h2>
        {historyLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : interactionHistory && interactionHistory.length > 0 ? (
          <VirtualizedList
            items={interactionHistory}
            itemHeight={150}
            containerHeight={600}
            overscan={2}
            className="rounded-lg"
            renderItem={(item: any, index: number) => {
              const getColorClass = (color: string) => {
                switch (color) {
                  case 'green':
                    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
                  case 'red':
                    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
                  case 'blue':
                    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
                  case 'orange':
                    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700';
                  case 'gray':
                    return 'bg-secondary text-secondary-foreground border-border';
                  default:
                    return 'bg-secondary text-secondary-foreground border-border';
                }
              };

              return (
                <div className={`border-l-4 rounded-lg p-4 mb-4 ${getColorClass(item.color)}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-2">{item.description}</p>
                      {item.details && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {item.details.serviceName && (
                            <div>
                              <span className="font-medium">Услуга:</span> {item.details.serviceName}
                            </div>
                          )}
                          {item.details.masterName && (
                            <div>
                              <span className="font-medium">Мастер:</span> {item.details.masterName}
                            </div>
                          )}
                          {item.details.startTime && (
                            <div>
                              <span className="font-medium">Время:</span>{' '}
                              {format(new Date(item.details.startTime), 'd MMM yyyy, HH:mm', {
                                locale: ru,
                              })}
                            </div>
                          )}
                          {item.details.price && (
                            <div>
                              <span className="font-medium">Стоимость:</span> {item.details.price} ₽
                            </div>
                          )}
                          {item.details.amount !== undefined && (
                            <div>
                              <span className="font-medium">Сумма:</span> {item.details.amount} баллов
                            </div>
                          )}
                          {item.details.channel && (
                            <div>
                              <span className="font-medium">Канал:</span> {item.details.channel}
                            </div>
                          )}
                          {item.details.cancellationReason && (
                            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded text-red-700 dark:text-red-300">
                              <span className="font-medium">Причина отмены:</span>{' '}
                              {item.details.cancellationReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">Нет истории взаимодействий</div>
        )}
      </div>

      {/* История записей (для обратной совместимости) */}
      <div className="bg-card rounded-lg shadow p-6 transition-colors border border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">Записи</h2>
        {appointmentsLoading ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((apt: any) => (
              <div
                key={apt.id}
                className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-foreground">{apt.service?.name}</h3>
                    <p className="text-sm text-muted-foreground">{apt.master?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{apt.price} ₽</p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        apt.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : apt.status === 'cancelled'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}
                    >
                      {apt.status === 'completed'
                        ? 'Завершена'
                        : apt.status === 'cancelled'
                        ? 'Отменена'
                        : 'Подтверждена'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Нет записей</div>
        )}
      </div>

      {/* Модальное окно для отправки сообщения */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить сообщение в Telegram</DialogTitle>
            <DialogDescription>
              Сообщение будет отправлено клиенту от имени бота
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Введите сообщение..."
            rows={5}
            className="mb-4"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMessageModal(false);
                setMessageText('');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (messageText.trim()) {
                  sendMessageMutation.mutate(messageText);
                } else {
                  toast.warning('Введите сообщение');
                }
              }}
              disabled={sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальное окно для редактирования комментария */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Комментарий админа</DialogTitle>
            <DialogDescription>
              Комментарий виден только администраторам
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Введите комментарий (виден только админам)..."
            rows={5}
            className="mb-4"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNotesModal(false);
                setAdminNotes(client?.adminNotes || '');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                updateNotesMutation.mutate(adminNotes);
              }}
              disabled={updateNotesMutation.isPending}
            >
              {updateNotesMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальное окно для настройки уведомлений */}
      <Dialog open={showNotificationSettingsModal} onOpenChange={setShowNotificationSettingsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Настройки уведомлений</DialogTitle>
            <DialogDescription>
              Настройте напоминания о записях для этого клиента
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="remindersEnabled" className="text-sm font-medium">
                Включить напоминания о записях
              </Label>
              <input
                id="remindersEnabled"
                type="checkbox"
                checked={remindersEnabled}
                onChange={(e) => setRemindersEnabled(e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
              />
            </div>
            {remindersEnabled && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Интервалы напоминаний (часы до записи)
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Выберите, за сколько часов до записи отправлять напоминания
                </p>
                <div className="space-y-2">
                  {[48, 24, 12, 6, 2, 1].map((hours) => (
                    <label key={hours} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reminderIntervals.includes(hours)}
                        onChange={(e) => {
                          const current = [...reminderIntervals];
                          if (e.target.checked) {
                            current.push(hours);
                            current.sort((a, b) => b - a);
                          } else {
                            const index = current.indexOf(hours);
                            if (index > -1) {
                              current.splice(index, 1);
                            }
                          }
                          setReminderIntervals(current);
                        }}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="ml-2 text-sm text-foreground">
                        За {hours} {hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}
                      </span>
                    </label>
                  ))}
                </div>
                {reminderIntervals.length === 0 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                    Выберите хотя бы один интервал
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNotificationSettingsModal(false);
                setRemindersEnabled(client?.notificationSettings?.remindersEnabled !== false);
                setReminderIntervals(client?.notificationSettings?.reminderIntervals || [24, 2]);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (remindersEnabled && reminderIntervals.length === 0) {
                  toast.warning('Выберите хотя бы один интервал напоминаний');
                  return;
                }
                updateNotificationSettingsMutation.mutate({
                  remindersEnabled,
                  reminderIntervals: remindersEnabled ? reminderIntervals : [],
                });
              }}
              disabled={updateNotificationSettingsMutation.isPending || (remindersEnabled && reminderIntervals.length === 0)}
            >
              {updateNotificationSettingsMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

