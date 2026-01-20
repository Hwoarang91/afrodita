'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Save, User, Bot, CheckCircle2, AlertCircle, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface VerifiedUser {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  phone?: string;
  telegramId: string;
  role: string;
  createdAt: string;
}

interface Settings {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  timezone?: string;
  telegramAdminUserId?: string | null;
  workingHours: {
    start: string;
    end: string;
  };
  bookingSettings: {
    minAdvanceBooking: number; // в часах
    maxAdvanceBooking: number; // в днях
    cancellationDeadline: number; // в часах
    manualConfirmation: boolean; // подтверждение записи вручную
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    telegramEnabled: boolean;
    reminderIntervals: number[]; // Интервалы напоминаний в часах (например, [24, 2])
  };
  bonuses: {
    enabled: boolean;
    pointsPerRuble: number;
    pointsForRegistration: number;
    referralBonus: number;
  };
  firstVisitDiscount: {
    enabled: boolean;
    type: 'percent' | 'fixed';
    value: number;
  };
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'booking' | 'notifications' | 'bonuses'>(
    'general',
  );
  const [isSaving, setIsSaving] = useState(false);
  
  const tabs = [
    { id: 'general', label: 'Общие' },
    { id: 'booking', label: 'Записи' },
    { id: 'notifications', label: 'Уведомления' },
    { id: 'bonuses', label: 'Бонусы' },
  ];

  const getDefaultSettings = (): Settings => {
    const saved = localStorage.getItem('admin-settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      businessName: 'Афродита',
      businessPhone: '',
      businessEmail: '',
      businessAddress: '',
      workingHours: {
        start: '09:00',
        end: '21:00',
      },
      bookingSettings: {
        minAdvanceBooking: 2,
        maxAdvanceBooking: 30,
        cancellationDeadline: 24,
        manualConfirmation: false,
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: true,
        telegramEnabled: true,
        reminderIntervals: [24, 2], // По умолчанию: за 24 часа и за 2 часа
      },
      bonuses: {
        enabled: true,
        pointsPerRuble: 0.1,
        pointsForRegistration: 100,
        referralBonus: 50,
      },
      firstVisitDiscount: {
        enabled: false,
        type: 'percent',
        value: 0,
      },
    };
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const defaultSettings = getDefaultSettings();
        
        // Загружаем настройки с сервера
        const [settingsData, timezoneData, reminderIntervalsData, firstVisitDiscountData, telegramAdminData, bonusData] = await Promise.all([
          apiClient.get('/settings').catch(() => ({ data: {} })),
          apiClient.get('/settings/timezone').catch(() => ({ data: { value: 'Europe/Moscow' } })),
          apiClient.get('/settings/reminder-intervals').catch(() => ({ data: { value: defaultSettings.notifications.reminderIntervals } })),
          apiClient.get('/settings/first-visit-discount').catch(() => ({ data: { value: defaultSettings.firstVisitDiscount } })),
          apiClient.get('/settings/telegram-admin-user').catch(() => ({ data: { value: null } })),
          apiClient.get('/settings/bonuses').catch(() => ({ data: { value: defaultSettings.bonuses } })),
        ]);
        
        // Объединяем настройки из API с дефолтными значениями
        const mergedSettings = {
          ...defaultSettings,
          timezone: timezoneData.data.value || defaultSettings.timezone || 'Europe/Moscow',
          telegramAdminUserId: telegramAdminData.data.value?.id || null,
          bookingSettings: {
            ...defaultSettings.bookingSettings,
            ...(settingsData.data.bookingSettings || {}),
          },
          notifications: {
            ...defaultSettings.notifications,
            reminderIntervals: reminderIntervalsData.data.value || defaultSettings.notifications.reminderIntervals,
          },
          firstVisitDiscount: firstVisitDiscountData.data.value || defaultSettings.firstVisitDiscount,
          bonuses: bonusData.data.value || defaultSettings.bonuses,
        };
        return mergedSettings;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[SettingsPage] Ошибка при загрузке настроек:', error);
        }
        // Если эндпоинт не существует, возвращаем дефолтные значения
        return getDefaultSettings();
      }
    },
    refetchOnWindowFocus: true, // Обновлять при фокусе окна
    staleTime: 0, // Всегда считать данные устаревшими
  });

  // Загружаем список верифицированных пользователей
  const { data: verifiedUsersData } = useQuery({
    queryKey: ['verified-users'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ data: VerifiedUser[] }>('/settings/verified-users');
        return response.data.data || [];
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[SettingsPage] Ошибка при загрузке верифицированных пользователей:', error);
        }
        return [];
      }
    },
  });

  const [formData, setFormData] = useState<Settings>(getDefaultSettings());

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Settings) => {
      try {
        // Сохраняем настройки бронирования
        const bookingSettingsToSave = {
          manualConfirmation: data.bookingSettings.manualConfirmation,
          minAdvanceBooking: data.bookingSettings.minAdvanceBooking,
          maxAdvanceBooking: data.bookingSettings.maxAdvanceBooking,
          cancellationDeadline: data.bookingSettings.cancellationDeadline,
        };
        
        await apiClient.put('/settings', {
          bookingSettings: bookingSettingsToSave,
        });
        
        // Сохраняем часовой пояс
        if (data.timezone) {
          await apiClient.put('/settings/timezone', { value: data.timezone });
        }
        
        // Сохраняем интервалы напоминаний (всегда, даже если массив пустой)
        const reminderIntervals = data.notifications?.reminderIntervals ?? [];
        if (process.env.NODE_ENV === 'development') {
          console.log('[SettingsPage] Сохранение интервалов напоминаний:', reminderIntervals);
        }
        const response = await apiClient.put('/settings/reminder-intervals', { 
          value: reminderIntervals 
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('[SettingsPage] Интервалы напоминаний успешно сохранены:', response.data);
        }
        
        // Сохраняем настройки скидки на первый визит
        if (data.firstVisitDiscount) {
          await apiClient.put('/settings/first-visit-discount', {
            value: data.firstVisitDiscount,
          });
        }
        
        // Сохраняем настройки бонусов
        if (data.bonuses) {
          await apiClient.put('/settings/bonuses', {
            value: data.bonuses,
          });
        }
        
        // Сохраняем администратора Telegram бота
        if (data.telegramAdminUserId !== undefined) {
          await apiClient.put('/settings/telegram-admin-user', {
            userId: data.telegramAdminUserId || null,
          });
        }
        
        // Также сохраняем в localStorage для совместимости
        localStorage.setItem('admin-settings', JSON.stringify(data));
      } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[SettingsPage] Ошибка при сохранении настроек:', error);
        }
        // Если эндпоинт не существует, просто сохраняем в localStorage
        if (error.response?.status === 404 || error.response?.status === 401) {
          localStorage.setItem('admin-settings', JSON.stringify(data));
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Настройки сохранены');
    },
    onError: (error: any) => {
      toast.error(`Ошибка при сохранении: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate(formData, {
      onSettled: () => {
        setIsSaving(false);
      },
    });
  };

  if (isLoading) {
    return <div className="p-8">Загрузка...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Настройки</h1>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </Button>
      </div>

      <div className="bg-card rounded-lg shadow">
        {/* Табы */}
        <div className="border-b border-border">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Содержимое табов */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">
                Общая информация
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Название салона
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.businessPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, businessPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.businessEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, businessEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={formData.businessAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, businessAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Часовой пояс
                  </label>
                  <select
                    value={formData.timezone || 'Europe/Moscow'}
                    onChange={(e) =>
                      setFormData({ ...formData, timezone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                  >
                    <option value="Europe/Moscow">Москва (UTC+3)</option>
                    <option value="Europe/Kiev">Киев (UTC+2)</option>
                    <option value="Europe/Minsk">Минск (UTC+3)</option>
                    <option value="Asia/Almaty">Алматы (UTC+6)</option>
                    <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                    <option value="Asia/Krasnoyarsk">Красноярск (UTC+7)</option>
                    <option value="Asia/Irkutsk">Иркутск (UTC+8)</option>
                    <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
                    <option value="Europe/London">Лондон (UTC+0)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <TelegramAdminSelector
                    value={formData.telegramAdminUserId || null}
                    onChange={(userId) =>
                      setFormData({ ...formData, telegramAdminUserId: userId })
                    }
                    verifiedUsers={verifiedUsersData || []}
                  />
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Примечание:</strong> Время работы определяется расписанием каждого мастера индивидуально. 
                  Настройте расписание мастера в разделе &quot;Мастера&quot; → выберите мастера → &quot;Расписание&quot;.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">
                Настройки записей
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Минимальное время до записи (часов)
                  </label>
                  <input
                    type="number"
                    value={formData.bookingSettings.minAdvanceBooking}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bookingSettings: {
                          ...formData.bookingSettings,
                          minAdvanceBooking: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    За сколько часов минимум можно записаться
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Максимальное время до записи (дней)
                  </label>
                  <input
                    type="number"
                    value={formData.bookingSettings.maxAdvanceBooking}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bookingSettings: {
                          ...formData.bookingSettings,
                          maxAdvanceBooking: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    На сколько дней вперед можно записаться
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Срок отмены (часов)
                  </label>
                  <input
                    type="number"
                    value={formData.bookingSettings.cancellationDeadline}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bookingSettings: {
                          ...formData.bookingSettings,
                          cancellationDeadline: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    За сколько часов до записи можно отменить
                  </p>
                </div>
                <div className="mt-6 p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Подтверждение записи вручную</h3>
                      <p className="text-sm text-muted-foreground">
                        Если включено, каждая запись требует подтверждения админом
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.bookingSettings.manualConfirmation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bookingSettings: {
                              ...formData.bookingSettings,
                              manualConfirmation: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">
                Настройки уведомлений
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Email уведомления</h3>
                    <p className="text-sm text-muted-foreground">
                      Отправка уведомлений по электронной почте
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifications.emailEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notifications: {
                            ...formData.notifications,
                            emailEnabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">SMS уведомления</h3>
                    <p className="text-sm text-muted-foreground">
                      Отправка уведомлений по SMS
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifications.smsEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notifications: {
                            ...formData.notifications,
                            smsEnabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Telegram уведомления</h3>
                    <p className="text-sm text-muted-foreground">
                      Отправка уведомлений через Telegram бота
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifications.telegramEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notifications: {
                            ...formData.notifications,
                            telegramEnabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {/* Настройки интервалов напоминаний */}
                <div className="mt-6 p-4 border border-border rounded-lg">
                  <h3 className="font-medium text-foreground mb-4">
                    Интервалы напоминаний о записях
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Выберите, за сколько часов до записи отправлять напоминания клиентам
                  </p>
                  <div className="space-y-3">
                    {[48, 24, 12, 6, 2, 1].map((hours) => (
                      <label key={hours} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.notifications.reminderIntervals?.includes(hours) || false}
                          onChange={(e) => {
                            const current = formData.notifications.reminderIntervals || [];
                            const updated = e.target.checked
                              ? [...current, hours].sort((a, b) => b - a) // Сортируем по убыванию
                              : current.filter((h) => h !== hours);
                            setFormData({
                              ...formData,
                              notifications: {
                                ...formData.notifications,
                                reminderIntervals: updated,
                              },
                            });
                          }}
                          className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-foreground">
                          За {hours} {hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Эти настройки применяются по умолчанию для всех клиентов. 
                    Каждый клиент может отключить напоминания в своем профиле.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bonuses' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">
                Настройки бонусной системы
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Бонусная система</h3>
                    <p className="text-sm text-muted-foreground">
                      Включить систему начисления бонусов
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.bonuses.enabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonuses: {
                            ...formData.bonuses,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                {formData.bonuses.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4 border-l-4 border-primary-200">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Баллов за рубль
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.bonuses.pointsPerRuble}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bonuses: {
                              ...formData.bonuses,
                              pointsPerRuble: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Сколько бонусных баллов начисляется за каждый потраченный рубль
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Баллов за регистрацию
                      </label>
                      <input
                        type="number"
                        value={formData.bonuses.pointsForRegistration}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bonuses: {
                              ...formData.bonuses,
                              pointsForRegistration: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Сколько бонусных баллов начисляется при регистрации
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Баллов за приглашение друга
                      </label>
                      <input
                        type="number"
                        value={formData.bonuses.referralBonus}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bonuses: {
                              ...formData.bonuses,
                              referralBonus: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Сколько бонусных баллов начисляется за приглашение друга (и новому пользователю, и пригласившему)
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Настройки скидки на первый визит */}
              <div className="mt-8 pt-8 border-t border-border">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  Скидка на первый визит
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h3 className="font-medium text-foreground">Включить скидку на первый визит</h3>
                      <p className="text-sm text-muted-foreground">
                        Автоматически применять скидку для всех новых клиентов при первой записи
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.firstVisitDiscount.enabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstVisitDiscount: {
                              ...formData.firstVisitDiscount,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  {formData.firstVisitDiscount.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4 border-l-4 border-primary-200">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Тип скидки
                        </label>
                        <select
                          value={formData.firstVisitDiscount.type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstVisitDiscount: {
                                ...formData.firstVisitDiscount,
                                type: e.target.value as 'percent' | 'fixed',
                              },
                            })
                          }
                          className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        >
                          <option value="percent">В процентах (%)</option>
                          <option value="fixed">В рублях (₽)</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Выберите способ расчета скидки
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {formData.firstVisitDiscount.type === 'percent' ? 'Процент скидки' : 'Размер скидки'}
                        </label>
                        <input
                          type="number"
                          step={formData.firstVisitDiscount.type === 'percent' ? '1' : '0.01'}
                          value={formData.firstVisitDiscount.value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstVisitDiscount: {
                                ...formData.firstVisitDiscount,
                                value: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                          min="0"
                          max={formData.firstVisitDiscount.type === 'percent' ? '100' : undefined}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {formData.firstVisitDiscount.type === 'percent'
                            ? 'Процент скидки от стоимости услуги (0-100)'
                            : 'Размер скидки в рублях'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TelegramAdminSelector({
  value,
  onChange,
  verifiedUsers,
}: {
  value: string | null;
  onChange: (userId: string | null) => void;
  verifiedUsers: VerifiedUser[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedUser = useMemo(
    () => verifiedUsers.find((u) => u.id === value) || null,
    [verifiedUsers, value]
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return verifiedUsers;
    const query = searchQuery.toLowerCase();
    return verifiedUsers.filter(
      (user) =>
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
    );
  }, [verifiedUsers, searchQuery]);

  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4" />
          Администратор Telegram бота и веб-приложения
        </Label>
        
        {selectedUser ? (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Выбран
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {selectedUser.username && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">@</span>
                          <span>{selectedUser.username}</span>
                        </div>
                      )}
                      {selectedUser.phone && (
                        <div className="flex items-center gap-1">
                          <span>📱</span>
                          <span>{selectedUser.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        <span>Telegram ID: {selectedUser.telegramId}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Роль: {selectedUser.role === 'admin' ? 'Администратор' : selectedUser.role === 'master' ? 'Мастер' : 'Клиент'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(null)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Администратор не выбран</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск пользователя по имени, username или телефону..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9"
          />
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
            />
            <Card className="absolute z-20 w-full mt-2 max-h-80 overflow-auto border shadow-lg bg-background">
              <CardContent className="p-0">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {searchQuery ? (
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <span>Пользователи не найдены</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <User className="h-5 w-5" />
                        <span>Нет верифицированных пользователей</span>
                        <span className="text-xs">Пользователи должны сначала пройти верификацию через Telegram бота</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelect(user.id)}
                        className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                          value === user.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`rounded-full p-2 flex-shrink-0 ${
                              value === user.id ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              <User className={`h-4 w-4 ${
                                value === user.id ? 'text-primary' : ''
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                                {user.username && (
                                  <div className="truncate">@{user.username}</div>
                                )}
                                {user.phone && <div>{user.phone}</div>}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px]">Роль: {user.role === 'admin' ? 'Администратор' : user.role === 'master' ? 'Мастер' : 'Клиент'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {value === user.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">О настройке администратора Telegram</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Выбранный администратор будет получать уведомления о новых записях, отменах и изменениях</li>
                <li>Только этот пользователь будет иметь доступ к админ-функциям в Telegram боте и веб-приложении</li>
                <li>Для выбора пользователь должен пройти верификацию через Telegram бота</li>
                <li>Всего верифицированных пользователей: {verifiedUsers.length}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Права администратора
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground mb-2">В Telegram боте:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр всех записей и статистики</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Подтверждение и отмена записей</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр списка клиентов</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Массовая рассылка сообщений</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Получение уведомлений о всех записях</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                <p className="font-semibold text-foreground mb-2">В веб-приложении:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Доступ к админ-панели со статистикой</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Управление записями и клиентами</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр всех данных системы</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                Права мастера
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground mb-2">В Telegram боте:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр своих записей</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Получение уведомлений о новых записях к нему</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр расписания работы</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                <p className="font-semibold text-foreground mb-2">В веб-приложении:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Просмотр своих записей и расписания</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Информация о клиентах с записями к нему</span>
                  </li>
                </ul>
              </div>
              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs text-orange-900 dark:text-orange-100">
                <p className="font-medium mb-1">Примечание:</p>
                <p>Мастера автоматически получают уведомления о новых записях. Настройка администратора не влияет на права мастера.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
