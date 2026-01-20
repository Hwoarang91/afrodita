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
import { Mail, Edit, Plus, Trash2, Calendar, Scale, Ruler, Upload, X, User } from 'lucide-react';
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
  const [showEditPersonalDataModal, setShowEditPersonalDataModal] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<any>(null);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Функция расчета возраста
  const calculateAge = (dateOfBirth: string | Date | null | undefined): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Функция склонения возраста
  const getAgeLabel = (age: number | null): string => {
    if (age === null) return '';
    const lastDigit = age % 10;
    const lastTwoDigits = age % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${age} лет`;
    if (lastDigit === 1) return `${age} год`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${age} года`;
    return `${age} лет`;
  };

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
    } else {
      setRemindersEnabled(true);
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

  const { data: bodyMeasurements, isLoading: measurementsLoading } = useQuery({
    queryKey: ['client-body-measurements', clientId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/users/${clientId}/body-measurements`);
        return data || [];
      } catch {
        return [];
      }
    },
  });

  const { data: latestMeasurement } = useQuery({
    queryKey: ['client-latest-measurement', clientId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/users/${clientId}/body-measurements/latest`);
        return data;
      } catch {
        return null;
      }
    },
  });

  const { data: referralStats } = useQuery({
    queryKey: ['client-referral-stats', clientId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/users/${clientId}/referral/stats`);
        return data;
      } catch {
        return null;
      }
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ['client-transactions', clientId],
    queryFn: async () => {
      try {
        // Получаем транзакции клиента через финансовый сервис для админа
        const { data } = await apiClient.get(`/financial/users/${clientId}/transactions`);
        return data || [];
      } catch {
        return [];
      }
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
    mutationFn: async (settings: { remindersEnabled: boolean }) => {
      await apiClient.put(`/users/${clientId}`, {
        notificationSettings: {
          remindersEnabled: settings.remindersEnabled,
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

  const updatePersonalDataMutation = useMutation({
    mutationFn: async (data: { dateOfBirth?: string; weight?: number }) => {
      await apiClient.put(`/users/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setShowEditPersonalDataModal(false);
      toast.success('Данные сохранены');
    },
  });

  const saveMeasurementMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMeasurement) {
        await apiClient.put(`/users/${clientId}/body-measurements/${editingMeasurement.id}`, data);
      } else {
        await apiClient.post(`/users/${clientId}/body-measurements`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-body-measurements', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-latest-measurement', clientId] });
      setShowMeasurementModal(false);
      setEditingMeasurement(null);
      toast.success('Замер сохранен');
    },
  });

  const deleteMeasurementMutation = useMutation({
    mutationFn: async (measurementId: string) => {
      await apiClient.delete(`/users/${clientId}/body-measurements/${measurementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-body-measurements', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-latest-measurement', clientId] });
      toast.success('Замер удален');
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      await apiClient.put(`/users/${clientId}`, { photoUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setShowPhotoUploadModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      toast.success('Фото загружено');
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/users/${clientId}`, { photoUrl: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      toast.success('Фото удалено');
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Размер файла не должен превышать 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Выберите файл изображения');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      toast.error('Выберите файл');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      uploadPhotoMutation.mutate(reader.result as string);
    };
    reader.onerror = () => {
      toast.error('Ошибка при чтении файла');
    };
    reader.readAsDataURL(photoFile);
  };

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
        <div className="flex items-start gap-6 mb-6">
          <div className="relative">
            {client?.photoUrl ? (
              <div className="relative group">
                <img
                  src={client.photoUrl}
                  alt={`${client?.firstName} ${client?.lastName}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-border"
                />
                <button
                  onClick={() => setShowPhotoUploadModal(true)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity"
                >
                  <Edit className="w-6 h-6 text-white" />
                </button>
              </div>
            ) : (
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                  <User className="w-12 h-12 text-muted-foreground" />
                </div>
                <button
                  onClick={() => setShowPhotoUploadModal(true)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity"
                >
                  <Upload className="w-6 h-6 text-white" />
                </button>
              </div>
            )}
            <button
              onClick={() => setShowPhotoUploadModal(true)}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
              title="Изменить фото"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {client?.firstName} {client?.lastName}
            </h1>
            {client?.photoUrl && (
              <button
                onClick={() => {
                  if (confirm('Удалить фото клиента?')) {
                    deletePhotoMutation.mutate();
                  }
                }}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                Удалить фото
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Личные данные</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditPersonalDataModal(true)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Редактировать
              </Button>
            </div>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Дата рождения:</span>{' '}
                {client?.dateOfBirth ? (
                  <span className="text-foreground">
                    {format(new Date(client.dateOfBirth), 'd MMMM yyyy', { locale: ru })}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 italic">Не указана</span>
                )}
              </div>
              {client?.dateOfBirth && (
                <div className="flex items-center gap-2">
                  <span className="font-medium ml-6">Возраст:</span>{' '}
                  <span className="text-foreground font-semibold">
                    {getAgeLabel(calculateAge(client.dateOfBirth))}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                <span className="font-medium">Вес:</span>{' '}
                {client?.weight ? (
                  <span className="text-foreground font-semibold">{Number(client.weight).toFixed(1)} кг</span>
                ) : (
                  <span className="text-muted-foreground/70 italic">Не указан</span>
                )}
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
                  <div className="text-muted-foreground text-xs mt-2">
                    Интервалы напоминаний настраиваются в глобальных настройках системы
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setRemindersEnabled(client?.notificationSettings?.remindersEnabled !== false);
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

      {/* Карточка замеров объемов тела */}
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 transition-colors">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Ruler className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Замеры объемов тела</h2>
          </div>
          <Button
            onClick={() => {
              setEditingMeasurement(null);
              setShowMeasurementModal(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить замер
          </Button>
        </div>

        {measurementsLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : bodyMeasurements && bodyMeasurements.length > 0 ? (
          <div className="space-y-4">
            {bodyMeasurements.map((measurement: any) => (
              <div
                key={measurement.id}
                className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(measurement.measurementDate), 'd MMMM yyyy', { locale: ru })}
                    </h3>
                    {measurement.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{measurement.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingMeasurement(measurement);
                        setShowMeasurementModal(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Удалить этот замер?')) {
                          deleteMeasurementMutation.mutate(measurement.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {measurement.weight && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Вес</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.weight).toFixed(1)} кг
                      </div>
                    </div>
                  )}
                  {measurement.chest && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Грудь</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.chest).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.waist && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Талия</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.waist).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.hips && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Бедра</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.hips).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.neck && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Шея</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.neck).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.shoulder && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Плечи</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.shoulder).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.armLeft && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Рука (л)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.armLeft).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.armRight && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Рука (п)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.armRight).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.thighLeft && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Бедро (л)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.thighLeft).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.thighRight && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Бедро (п)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.thighRight).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.calfLeft && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Икра (л)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.calfLeft).toFixed(1)} см
                      </div>
                    </div>
                  )}
                  {measurement.calfRight && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Икра (п)</div>
                      <div className="text-lg font-semibold text-foreground">
                        {Number(measurement.calfRight).toFixed(1)} см
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            <Ruler className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет замеров. Добавьте первый замер объемов тела.</p>
          </div>
        )}
      </div>

      {/* Карточка реферальной программы */}
      {referralStats && (
        <div className="bg-card rounded-lg shadow-lg p-6 mb-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Реферальная программа</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Реферальный код:</p>
                  <p className="text-lg font-mono font-semibold text-foreground">{referralStats.referralCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Всего приглашено:</p>
                  <p className="text-lg font-semibold text-foreground">{referralStats.totalReferrals}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Бонусы клиента:</p>
                  <p className="text-lg font-semibold text-primary">{client?.bonusPoints || 0} баллов</p>
                </div>
              </div>
            </div>

            {referralStats.referrals && referralStats.referrals.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Приглашенные друзья:</h3>
                <div className="space-y-3">
                  {referralStats.referrals.map((ref: any) => {
                    // Проверяем, прошла ли окончательная регистрация (есть телефон - значит прошел полную регистрацию)
                    const hasCompletedRegistration = !!ref.phone;
                    
                    // Находим транзакции бонусов за этого реферала
                    // Ищем транзакции, которые:
                    // 1. Имеют тип BONUS_EARNED
                    // 2. Созданы в день регистрации реферала или позже
                    // 3. Содержат в описании информацию о реферале или "приглашение друга"
                    const refRegistrationDate = new Date(ref.createdAt);
                    const refDateStr = refRegistrationDate.toISOString().split('T')[0];
                    
                    const bonusForThisReferral = transactions?.find((t: any) => {
                      // Проверяем тип транзакции (может быть enum или строка)
                      if (t.type !== 'BONUS_EARNED' && t.type !== 'bonus_earned') return false;
                      const tDateStr = new Date(t.createdAt).toISOString().split('T')[0];
                      // Транзакция должна быть создана в день регистрации реферала или позже
                      if (tDateStr < refDateStr) return false;
                      // Описание должно содержать информацию о реферале или "приглашение друга"
                      const description = (t.description || '').toLowerCase();
                      const refNameLower = (ref.firstName || '').toLowerCase();
                      return description.includes('приглашение друга') || 
                             description.includes('referral') ||
                             (refNameLower && description.includes(refNameLower));
                    });

                    return (
                      <div
                        key={ref.id}
                        className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/clients/${ref.id}`}
                                className="font-semibold text-foreground hover:text-primary transition-colors"
                              >
                                {ref.firstName} {ref.lastName}
                              </Link>
                              {hasCompletedRegistration ? (
                                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                  Зарегистрирован
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                  Незавершена регистрация
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Приглашен: {format(new Date(ref.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </p>
                          </div>
                        </div>
                        
                        {bonusForThisReferral && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Получено бонусов:</span>{' '}
                              <span className="text-primary font-semibold">+{bonusForThisReferral.amount}</span> баллов{' '}
                              <span className="text-muted-foreground/70">
                                ({bonusForThisReferral.description || 'За приглашение друга'})
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Начислено: {format(new Date(bonusForThisReferral.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </p>
                          </div>
                        )}
                        
                        {!bonusForThisReferral && hasCompletedRegistration && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground italic">
                              Бонусы за этого реферала еще не начислены или не найдены в транзакциях
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Клиент еще не пригласил никого по реферальной программе</p>
              </div>
            )}
          </div>
        </div>
      )}

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
              Настройте напоминания о записях для этого клиента. Интервалы напоминаний настраиваются в глобальных настройках системы.
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
            <p className="text-xs text-muted-foreground">
              Интервалы напоминаний (48ч, 24ч, 12ч, 6ч, 2ч, 1ч) настраиваются в разделе &quot;Настройки&quot; → &quot;Уведомления&quot;
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNotificationSettingsModal(false);
                setRemindersEnabled(client?.notificationSettings?.remindersEnabled !== false);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                updateNotificationSettingsMutation.mutate({
                  remindersEnabled,
                });
              }}
              disabled={updateNotificationSettingsMutation.isPending}
            >
              {updateNotificationSettingsMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальное окно для редактирования персональных данных */}
      <PersonalDataModal
        open={showEditPersonalDataModal}
        onOpenChange={setShowEditPersonalDataModal}
        client={client}
        onSave={(data) => {
          updatePersonalDataMutation.mutate(data);
        }}
        isLoading={updatePersonalDataMutation.isPending}
      />

      {/* Модальное окно для редактирования замера */}
      <MeasurementModal
        open={showMeasurementModal}
        onOpenChange={setShowMeasurementModal}
        measurement={editingMeasurement}
        onSave={(data) => {
          saveMeasurementMutation.mutate(data);
        }}
        isLoading={saveMeasurementMutation.isPending}
      />

      {/* Модальное окно для загрузки фото */}
      <Dialog open={showPhotoUploadModal} onOpenChange={setShowPhotoUploadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Загрузить фото клиента</DialogTitle>
            <DialogDescription>
              Выберите изображение (JPG, PNG, размер до 5MB)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="photo">Выберите файл</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="mt-1"
              />
            </div>
            {photoPreview && (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain rounded-lg border border-border"
                />
                <button
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoFile(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPhotoUploadModal(false);
                setPhotoFile(null);
                setPhotoPreview(null);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handlePhotoUpload}
              disabled={!photoFile || uploadPhotoMutation.isPending}
            >
              {uploadPhotoMutation.isPending ? 'Загрузка...' : 'Загрузить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Компонент модального окна для персональных данных
function PersonalDataModal({
  open,
  onOpenChange,
  client,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  onSave: (data: { dateOfBirth?: string; weight?: number }) => void;
  isLoading: boolean;
}) {
  const [dateOfBirth, setDateOfBirth] = useState(
    client?.dateOfBirth ? format(new Date(client.dateOfBirth), 'yyyy-MM-dd') : ''
  );
  const [weight, setWeight] = useState(
    client?.weight ? Number(client.weight).toFixed(1) : ''
  );

  useEffect(() => {
    if (client) {
      setDateOfBirth(
        client.dateOfBirth ? format(new Date(client.dateOfBirth), 'yyyy-MM-dd') : ''
      );
      setWeight(client.weight ? Number(client.weight).toFixed(1) : '');
    }
  }, [client, open]);

  const handleSave = () => {
    const data: any = {};
    if (dateOfBirth) {
      data.dateOfBirth = dateOfBirth;
    }
    if (weight) {
      data.weight = parseFloat(weight);
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать личные данные</DialogTitle>
          <DialogDescription>
            Укажите дату рождения и вес клиента
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="dateOfBirth">Дата рождения</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="weight">Вес (кг)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1"
              placeholder="0.0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Компонент модального окна для замеров
function MeasurementModal({
  open,
  onOpenChange,
  measurement,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement: any;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    measurementDate: measurement?.measurementDate
      ? format(new Date(measurement.measurementDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd'),
    weight: measurement?.weight ? Number(measurement.weight).toFixed(1) : '',
    neck: measurement?.neck ? Number(measurement.neck).toFixed(1) : '',
    chest: measurement?.chest ? Number(measurement.chest).toFixed(1) : '',
    waist: measurement?.waist ? Number(measurement.waist).toFixed(1) : '',
    hips: measurement?.hips ? Number(measurement.hips).toFixed(1) : '',
    thighLeft: measurement?.thighLeft ? Number(measurement.thighLeft).toFixed(1) : '',
    thighRight: measurement?.thighRight ? Number(measurement.thighRight).toFixed(1) : '',
    armLeft: measurement?.armLeft ? Number(measurement.armLeft).toFixed(1) : '',
    armRight: measurement?.armRight ? Number(measurement.armRight).toFixed(1) : '',
    calfLeft: measurement?.calfLeft ? Number(measurement.calfLeft).toFixed(1) : '',
    calfRight: measurement?.calfRight ? Number(measurement.calfRight).toFixed(1) : '',
    shoulder: measurement?.shoulder ? Number(measurement.shoulder).toFixed(1) : '',
    notes: measurement?.notes || '',
  });

  useEffect(() => {
    if (measurement) {
      setFormData({
        measurementDate: format(new Date(measurement.measurementDate), 'yyyy-MM-dd'),
        weight: measurement.weight ? Number(measurement.weight).toFixed(1) : '',
        neck: measurement.neck ? Number(measurement.neck).toFixed(1) : '',
        chest: measurement.chest ? Number(measurement.chest).toFixed(1) : '',
        waist: measurement.waist ? Number(measurement.waist).toFixed(1) : '',
        hips: measurement.hips ? Number(measurement.hips).toFixed(1) : '',
        thighLeft: measurement.thighLeft ? Number(measurement.thighLeft).toFixed(1) : '',
        thighRight: measurement.thighRight ? Number(measurement.thighRight).toFixed(1) : '',
        armLeft: measurement.armLeft ? Number(measurement.armLeft).toFixed(1) : '',
        armRight: measurement.armRight ? Number(measurement.armRight).toFixed(1) : '',
        calfLeft: measurement.calfLeft ? Number(measurement.calfLeft).toFixed(1) : '',
        calfRight: measurement.calfRight ? Number(measurement.calfRight).toFixed(1) : '',
        shoulder: measurement.shoulder ? Number(measurement.shoulder).toFixed(1) : '',
        notes: measurement.notes || '',
      });
    } else {
      setFormData({
        measurementDate: format(new Date(), 'yyyy-MM-dd'),
        weight: '',
        neck: '',
        chest: '',
        waist: '',
        hips: '',
        thighLeft: '',
        thighRight: '',
        armLeft: '',
        armRight: '',
        calfLeft: '',
        calfRight: '',
        shoulder: '',
        notes: '',
      });
    }
  }, [measurement, open]);

  const handleSave = () => {
    const data: any = {
      measurementDate: formData.measurementDate,
      notes: formData.notes || undefined,
    };

    if (formData.weight) data.weight = parseFloat(formData.weight);
    if (formData.neck) data.neck = parseFloat(formData.neck);
    if (formData.chest) data.chest = parseFloat(formData.chest);
    if (formData.waist) data.waist = parseFloat(formData.waist);
    if (formData.hips) data.hips = parseFloat(formData.hips);
    if (formData.thighLeft) data.thighLeft = parseFloat(formData.thighLeft);
    if (formData.thighRight) data.thighRight = parseFloat(formData.thighRight);
    if (formData.armLeft) data.armLeft = parseFloat(formData.armLeft);
    if (formData.armRight) data.armRight = parseFloat(formData.armRight);
    if (formData.calfLeft) data.calfLeft = parseFloat(formData.calfLeft);
    if (formData.calfRight) data.calfRight = parseFloat(formData.calfRight);
    if (formData.shoulder) data.shoulder = parseFloat(formData.shoulder);

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{measurement ? 'Редактировать замер' : 'Новый замер объемов тела'}</DialogTitle>
          <DialogDescription>
            Укажите все необходимые параметры (все поля опциональны)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="measurementDate">Дата замера</Label>
            <Input
              id="measurementDate"
              type="date"
              value={formData.measurementDate}
              onChange={(e) =>
                setFormData({ ...formData, measurementDate: e.target.value })
              }
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight">Вес (кг)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="neck">Обхват шеи (см)</Label>
              <Input
                id="neck"
                type="number"
                step="0.1"
                min="0"
                value={formData.neck}
                onChange={(e) => setFormData({ ...formData, neck: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="chest">Обхват груди (см)</Label>
              <Input
                id="chest"
                type="number"
                step="0.1"
                min="0"
                value={formData.chest}
                onChange={(e) => setFormData({ ...formData, chest: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="waist">Обхват талии (см)</Label>
              <Input
                id="waist"
                type="number"
                step="0.1"
                min="0"
                value={formData.waist}
                onChange={(e) => setFormData({ ...formData, waist: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="hips">Обхват бедер (см)</Label>
              <Input
                id="hips"
                type="number"
                step="0.1"
                min="0"
                value={formData.hips}
                onChange={(e) => setFormData({ ...formData, hips: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="shoulder">Ширина плеч (см)</Label>
              <Input
                id="shoulder"
                type="number"
                step="0.1"
                min="0"
                value={formData.shoulder}
                onChange={(e) => setFormData({ ...formData, shoulder: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="armLeft">Обхват руки левой (см)</Label>
              <Input
                id="armLeft"
                type="number"
                step="0.1"
                min="0"
                value={formData.armLeft}
                onChange={(e) => setFormData({ ...formData, armLeft: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="armRight">Обхват руки правой (см)</Label>
              <Input
                id="armRight"
                type="number"
                step="0.1"
                min="0"
                value={formData.armRight}
                onChange={(e) => setFormData({ ...formData, armRight: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="thighLeft">Обхват бедра левого (см)</Label>
              <Input
                id="thighLeft"
                type="number"
                step="0.1"
                min="0"
                value={formData.thighLeft}
                onChange={(e) => setFormData({ ...formData, thighLeft: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="thighRight">Обхват бедра правого (см)</Label>
              <Input
                id="thighRight"
                type="number"
                step="0.1"
                min="0"
                value={formData.thighRight}
                onChange={(e) => setFormData({ ...formData, thighRight: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="calfLeft">Обхват икры левой (см)</Label>
              <Input
                id="calfLeft"
                type="number"
                step="0.1"
                min="0"
                value={formData.calfLeft}
                onChange={(e) => setFormData({ ...formData, calfLeft: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
            <div>
              <Label htmlFor="calfRight">Обхват икры правой (см)</Label>
              <Input
                id="calfRight"
                type="number"
                step="0.1"
                min="0"
                value={formData.calfRight}
                onChange={(e) => setFormData({ ...formData, calfRight: e.target.value })}
                className="mt-1"
                placeholder="0.0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Заметки</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1"
              placeholder="Дополнительные заметки о замере..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

