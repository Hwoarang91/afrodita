'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Edit, Plus, X, Calendar, Clock } from 'lucide-react';
import ChatSelector from './ChatSelector';

interface ScheduledMessage {
  id: string;
  chatId: string;
  type: 'text' | 'photo' | 'video' | 'audio' | 'document' | 'sticker' | 'poll';
  message: string | null;
  mediaUrl: string | null;
  caption: string | null;
  pollOptions: string[] | null;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  errorMessage: string | null;
  sentAt: string | null;
  isRecurring: boolean;
  recurringPattern: string | null;
  recurringConfig: Record<string, any> | null;
  recurringEndDate: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ScheduledMessagesManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const queryClient = useQueryClient();

  const { data: scheduledMessages, isLoading } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/scheduled-messages');
      return data as ScheduledMessage[];
    },
  });

  const [formData, setFormData] = useState({
    chatId: '',
    type: 'text' as ScheduledMessage['type'],
    message: '',
    mediaUrl: '',
    caption: '',
    pollOptions: ['Вариант 1', 'Вариант 2'],
    scheduledAt: '',
    isRecurring: false,
    recurringPattern: 'daily' as 'daily' | 'weekly' | 'monthly' | 'custom',
    recurringConfig: { days: 1 } as Record<string, any>,
    recurringEndDate: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiClient.post('/telegram/scheduled-messages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Сообщение запланировано');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при создании запланированного сообщения');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiClient.put(`/telegram/scheduled-messages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      setIsDialogOpen(false);
      setEditingMessage(null);
      toast.success('Запланированное сообщение обновлено');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении сообщения');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/telegram/scheduled-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Запланированное сообщение удалено');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при удалении сообщения');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.post(`/telegram/scheduled-messages/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Запланированное сообщение отменено');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отмене сообщения');
    },
  });

  const resetForm = () => {
    setFormData({
      chatId: '',
      type: 'text',
      message: '',
      mediaUrl: '',
      caption: '',
      pollOptions: ['Вариант 1', 'Вариант 2'],
      scheduledAt: '',
      isRecurring: false,
      recurringPattern: 'daily',
      recurringConfig: { days: 1 },
      recurringEndDate: '',
    });
  };

  const handleCreate = () => {
    setEditingMessage(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setFormData({
      chatId: message.chatId,
      type: message.type,
      message: message.message || '',
      mediaUrl: message.mediaUrl || '',
      caption: message.caption || '',
      pollOptions: message.pollOptions || ['Вариант 1', 'Вариант 2'],
      scheduledAt: new Date(message.scheduledAt).toISOString().slice(0, 16),
      isRecurring: message.isRecurring,
      recurringPattern: (message.recurringPattern as any) || 'daily',
      recurringConfig: message.recurringConfig || { days: 1 },
      recurringEndDate: message.recurringEndDate ? new Date(message.recurringEndDate).toISOString().slice(0, 16) : '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.chatId || !formData.scheduledAt) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    if (formData.type === 'text' && !formData.message) {
      toast.error('Введите текст сообщения');
      return;
    }

    if (['photo', 'video', 'audio', 'document', 'sticker'].includes(formData.type) && !formData.mediaUrl) {
      toast.error('Введите URL или file_id медиа');
      return;
    }

    if (formData.type === 'poll' && (!formData.message || formData.pollOptions.length < 2)) {
      toast.error('Введите вопрос опроса и минимум 2 варианта ответа');
      return;
    }

    const data: any = {
      chatId: formData.chatId,
      type: formData.type,
      scheduledAt: new Date(formData.scheduledAt).toISOString(),
      isRecurring: formData.isRecurring,
    };

    if (formData.type === 'text') {
      data.message = formData.message;
    } else if (formData.type === 'poll') {
      data.message = formData.message;
      data.pollOptions = formData.pollOptions.filter(opt => opt.trim() !== '');
    } else {
      data.mediaUrl = formData.mediaUrl;
      if (formData.caption) {
        data.caption = formData.caption;
      }
    }

    if (formData.isRecurring) {
      data.recurringPattern = formData.recurringPattern;
      data.recurringConfig = formData.recurringConfig;
      if (formData.recurringEndDate) {
        data.recurringEndDate = new Date(formData.recurringEndDate).toISOString();
      }
    }

    if (editingMessage) {
      updateMutation.mutate({ id: editingMessage.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'default', label: 'Ожидает' },
      sent: { variant: 'secondary', label: 'Отправлено' },
      failed: { variant: 'destructive', label: 'Ошибка' },
      cancelled: { variant: 'outline', label: 'Отменено' },
    };
    return badges[status] || { variant: 'secondary', label: status };
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Текст',
      photo: 'Фото',
      video: 'Видео',
      audio: 'Аудио',
      document: 'Документ',
      sticker: 'Стикер',
      poll: 'Опрос',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Планировщик сообщений</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Запланируйте отправку сообщений в Telegram на определенное время
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Запланировать сообщение
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scheduledMessages?.map((message) => {
          const statusBadge = getStatusBadge(message.status);
          return (
            <Card key={message.id} className={message.status === 'pending' ? '' : 'opacity-75'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{getTypeLabel(message.type)}</CardTitle>
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Чат:</strong> {message.chatId}
                  </p>
                  <p>
                    <strong>Запланировано:</strong>{' '}
                    {new Date(message.scheduledAt).toLocaleString('ru-RU')}
                  </p>
                  {message.message && (
                    <p>
                      <strong>Сообщение:</strong> {message.message.substring(0, 50)}
                      {message.message.length > 50 ? '...' : ''}
                    </p>
                  )}
                  {message.isRecurring && (
                    <p>
                      <strong>Повтор:</strong> {message.recurringPattern}
                    </p>
                  )}
                  {message.sentCount > 0 && (
                    <p>
                      <strong>Отправлено раз:</strong> {message.sentCount}
                    </p>
                  )}
                  {message.errorMessage && (
                    <p className="text-destructive">
                      <strong>Ошибка:</strong> {message.errorMessage}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  {message.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(message)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('Вы уверены, что хотите отменить это сообщение?')) {
                            cancelMutation.mutate(message.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Отменить
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
                        deleteMutation.mutate(message.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {scheduledMessages?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Нет запланированных сообщений</p>
            <Button onClick={handleCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Запланировать первое сообщение
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'Редактировать запланированное сообщение' : 'Запланировать сообщение'}
            </DialogTitle>
            <DialogDescription>
              Настройте сообщение и время его отправки в Telegram
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ChatSelector value={formData.chatId} onChange={(value) => setFormData({ ...formData, chatId: value })} />

            <div>
              <Label htmlFor="type">Тип сообщения</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ScheduledMessage['type'] })}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
              >
                <option value="text">Текст</option>
                <option value="photo">Фото</option>
                <option value="video">Видео</option>
                <option value="audio">Аудио</option>
                <option value="document">Документ</option>
                <option value="sticker">Стикер</option>
                <option value="poll">Опрос</option>
              </select>
            </div>

            {formData.type === 'text' && (
              <div>
                <Label htmlFor="message">Текст сообщения *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                  placeholder="Введите текст сообщения..."
                />
              </div>
            )}

            {formData.type === 'poll' && (
              <>
                <div>
                  <Label htmlFor="pollQuestion">Вопрос опроса *</Label>
                  <Input
                    id="pollQuestion"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Введите вопрос опроса..."
                  />
                </div>
                <div>
                  <Label>Варианты ответов *</Label>
                  {formData.pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...formData.pollOptions];
                          newOptions[index] = e.target.value;
                          setFormData({ ...formData, pollOptions: newOptions });
                        }}
                        placeholder={`Вариант ${index + 1}`}
                      />
                      {formData.pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newOptions = formData.pollOptions.filter((_, i) => i !== index);
                            setFormData({ ...formData, pollOptions: newOptions });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...formData, pollOptions: [...formData.pollOptions, ''] });
                    }}
                  >
                    Добавить вариант
                  </Button>
                </div>
              </>
            )}

            {['photo', 'video', 'audio', 'document', 'sticker'].includes(formData.type) && (
              <>
                <div>
                  <Label htmlFor="mediaUrl">URL или File ID медиа *</Label>
                  <Input
                    id="mediaUrl"
                    value={formData.mediaUrl}
                    onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg или file_id"
                  />
                </div>
                {formData.type !== 'sticker' && (
                  <div>
                    <Label htmlFor="caption">Подпись (опционально)</Label>
                    <Textarea
                      id="caption"
                      value={formData.caption}
                      onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                      rows={3}
                      placeholder="Подпись к медиа..."
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <Label htmlFor="scheduledAt">Дата и время отправки *</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              />
              <Label htmlFor="isRecurring">Повторяющееся сообщение</Label>
            </div>

            {formData.isRecurring && (
              <>
                <div>
                  <Label htmlFor="recurringPattern">Паттерн повторения</Label>
                  <select
                    id="recurringPattern"
                    value={formData.recurringPattern}
                    onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value as any })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="daily">Ежедневно</option>
                    <option value="weekly">Еженедельно</option>
                    <option value="monthly">Ежемесячно</option>
                    <option value="custom">Настраиваемый</option>
                  </select>
                </div>
                {formData.recurringPattern === 'custom' && (
                  <div>
                    <Label htmlFor="customDays">Интервал (дни)</Label>
                    <Input
                      id="customDays"
                      type="number"
                      min="1"
                      value={formData.recurringConfig.days || 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurringConfig: { days: parseInt(e.target.value, 10) || 1 },
                        })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="recurringEndDate">Дата окончания повторений (опционально)</Label>
                  <Input
                    id="recurringEndDate"
                    type="datetime-local"
                    value={formData.recurringEndDate}
                    onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingMessage ? 'Сохранить' : 'Запланировать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

