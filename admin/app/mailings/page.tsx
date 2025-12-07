'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import FormattingHelp from '../telegram/FormattingHelp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, X, CheckCircle2, XCircle, Clock, Loader2, Send, ChevronLeft, ChevronRight, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Динамический импорт ReactQuill для избежания SSR проблем
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface Broadcast {
  title: string;
  message: string;
  channel: 'telegram' | 'sms' | 'email';
  role?: 'client' | 'admin' | 'master';
  userIds?: string[];
}

interface BroadcastHistory {
  broadcastId?: string;
  title: string;
  message: string;
  channel: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  notificationIds: string[];
}

interface BroadcastDetails {
  broadcastId?: string;
  title: string;
  message: string;
  channel: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  recipients: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    } | null;
    status: string;
    sentAt?: string;
    error?: string;
  }>;
}

export default function MailingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastHistory | null>(null);
  const [broadcastDetails, setBroadcastDetails] = useState<BroadcastDetails | null>(null);
  const [formData, setFormData] = useState<Broadcast>({
    title: '',
    message: '',
    channel: 'telegram',
    role: 'client',
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // CSS для ReactQuill загружается через globals.css

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['broadcast-history', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/broadcast/history', {
        params: { page, limit: 20 },
      });
      return data;
    },
  });

  // Сбрасываем выбранные элементы при смене страницы
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const sendMutation = useMutation({
    mutationFn: async (data: Broadcast) => {
      const { data: result } = await apiClient.post('/notifications/broadcast', data);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-history'] });
      setIsModalOpen(false);
      setFormData({ title: '', message: '', channel: 'telegram', role: 'client' });
      toast.success(
        `Рассылка отправлена! Всего: ${result.total}, Отправлено: ${result.sent}, Ошибок: ${result.failed}`,
      );
    },
    onError: (error: any) => {
      toast.error(`Ошибка при отправке рассылки: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notifications/${id}`);
    },
    onSuccess: (_, id) => {
      // Удаляем из выбранных
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
      queryClient.invalidateQueries({ queryKey: ['broadcast-history'] });
      toast.success('Рассылка удалена');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.request({
        method: 'DELETE',
        url: '/notifications/batch',
        data: { ids },
      });
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-history'] });
      setSelectedIds(new Set());
      toast.success(`Удалено ${result.deleted} рассылок`);
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set<string>(history?.data?.flatMap((item: BroadcastHistory) => item.notificationIds) || []);
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (broadcast: BroadcastHistory, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      broadcast.notificationIds.forEach(id => newSelected.add(id));
    } else {
      broadcast.notificationIds.forEach(id => newSelected.delete(id));
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      toast.info('Выберите рассылки для удаления');
      return;
    }
    deleteBatchMutation.mutate(Array.from(selectedIds));
  };

  const handleViewDetails = async (broadcast: BroadcastHistory) => {
    setSelectedBroadcast(broadcast);
    setIsDetailsModalOpen(true);
    
    try {
      let details;
      if (broadcast.broadcastId) {
        const { data } = await apiClient.get(`/notifications/broadcast/${broadcast.broadcastId}/details`);
        details = data;
      } else {
        // Для старых рассылок без broadcastId
        const { data } = await apiClient.get('/notifications/broadcast/details', {
          params: {
            title: broadcast.title,
            message: broadcast.message,
            channel: broadcast.channel,
            createdAt: broadcast.createdAt,
          },
        });
        details = data;
      }
      setBroadcastDetails(details);
    } catch (error: any) {
      toast.error(`Ошибка при загрузке деталей: ${error.message}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate(formData);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Рассылки</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Новая рассылка
        </Button>
      </div>

      {/* История рассылок */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>История рассылок</CardTitle>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleteBatchMutation.isPending}
              >
                {deleteBatchMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить выделенные ({selectedIds.size})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
        {historyLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={history?.data?.length > 0 && selectedIds.size === history.data.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                </TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Заголовок</TableHead>
                <TableHead>Канал</TableHead>
                <TableHead>Получателей</TableHead>
                <TableHead>Статистика</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.data?.map((item: BroadcastHistory, index: number) => {
                const isSelected = item.notificationIds.some(id => selectedIds.has(id));
                return (
                  <TableRow 
                    key={item.broadcastId || `${item.title}-${item.createdAt}-${index}`} 
                    className={cn(
                      isSelected && 'bg-accent',
                      'cursor-pointer'
                    )}
                    onClick={() => handleViewDetails(item)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectItem(item, e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.channel === 'telegram' && (
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Telegram
                        </div>
                      )}
                      {item.channel === 'sms' && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </div>
                      )}
                      {item.channel === 'email' && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.total} получателей
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="default" className="w-fit">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Отправлено: {item.sent}
                        </Badge>
                        {item.failed > 0 && (
                          <Badge variant="destructive" className="w-fit">
                            <XCircle className="h-3 w-3 mr-1" />
                            Ошибок: {item.failed}
                          </Badge>
                        )}
                        {item.pending > 0 && (
                          <Badge variant="secondary" className="w-fit">
                            <Clock className="h-3 w-3 mr-1" />
                            Ожидает: {item.pending}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          deleteBatchMutation.mutate(item.notificationIds);
                        }}
                        disabled={deleteBatchMutation.isPending}
                        className="text-destructive hover:text-destructive"
                        title="Удалить рассылку"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {(!history?.data || history.data.length === 0) && !historyLoading && (
          <div className="text-center py-12 text-muted-foreground">Нет истории рассылок</div>
        )}
        {history && history.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              Страница {page} из {history.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(history.totalPages, p + 1))}
              disabled={page === history.totalPages}
            >
              Вперед
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Модальное окно с деталями рассылки */}
      <Dialog open={isDetailsModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDetailsModalOpen(false);
          setSelectedBroadcast(null);
          setBroadcastDetails(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали рассылки</DialogTitle>
            <DialogDescription>
              Подробная информация о рассылке и получателях
            </DialogDescription>
          </DialogHeader>

          {broadcastDetails ? (
            <div className="space-y-6">
              {/* Основная информация */}
              <Card>
                <CardHeader>
                  <CardTitle>{broadcastDetails.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Канал:</span>{' '}
                      {broadcastDetails.channel === 'telegram' && (
                        <span className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Telegram
                        </span>
                      )}
                      {broadcastDetails.channel === 'sms' && (
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </span>
                      )}
                      {broadcastDetails.channel === 'email' && (
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Дата создания:</span>{' '}
                      {format(new Date(broadcastDetails.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Badge variant="default">Всего: {broadcastDetails.total}</Badge>
                      <Badge variant="default">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Отправлено: {broadcastDetails.sent}
                      </Badge>
                      {broadcastDetails.failed > 0 && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Ошибок: {broadcastDetails.failed}
                        </Badge>
                      )}
                      {broadcastDetails.pending > 0 && (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Ожидает: {broadcastDetails.pending}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Сообщение */}
              <div>
                <h4 className="font-semibold mb-2">Сообщение:</h4>
                <Card>
                  <CardContent className="p-4">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: broadcastDetails.message }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Список получателей */}
              <div>
                <h4 className="font-semibold mb-3">Получатели ({broadcastDetails.recipients.length}):</h4>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Получатель</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Дата отправки</TableHead>
                        <TableHead>Ошибка</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {broadcastDetails.recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            {recipient.user ? (
                              <div>
                                <div className="font-medium">
                                  {recipient.user.firstName} {recipient.user.lastName}
                                </div>
                                {recipient.user.email && (
                                  <div className="text-muted-foreground text-xs">{recipient.user.email}</div>
                                )}
                                {recipient.user.phone && (
                                  <div className="text-muted-foreground text-xs">{recipient.user.phone}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Пользователь удален</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                recipient.status === 'sent'
                                  ? 'default'
                                  : recipient.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {recipient.status === 'sent' ? 'Отправлено' : recipient.status === 'failed' ? 'Ошибка' : 'Ожидает'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {recipient.sentAt
                              ? format(new Date(recipient.sentAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-destructive">
                            {recipient.error || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Загрузка деталей...
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailsModalOpen(false);
                setSelectedBroadcast(null);
                setBroadcastDetails(null);
              }}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальное окно создания рассылки */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая рассылка</DialogTitle>
            <DialogDescription>
              Создайте новую рассылку для клиентов, мастеров или администраторов
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Заголовок</Label>
              <Input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Сообщение</Label>
              {formData.channel === 'telegram' && <FormattingHelp />}
              {formData.channel === 'telegram' ? (
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Введите текст сообщения с поддержкой HTML/Markdown форматирования..."
                  required
                />
              ) : (
                <div className="bg-background">
                  <ReactQuill
                    value={formData.message}
                    onChange={(value) => setFormData({ ...formData, message: value })}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        [{ color: [] }, { background: [] }],
                        ['link'],
                        ['clean'],
                      ],
                    }}
                    formats={[
                      'header',
                      'bold',
                      'italic',
                      'underline',
                      'strike',
                      'list',
                      'bullet',
                      'color',
                      'background',
                      'link',
                    ]}
                    placeholder="Введите текст сообщения..."
                    style={{ minHeight: '200px' }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.channel === 'telegram' 
                  ? 'Поддерживается HTML и Markdown форматирование (см. справку выше)'
                  : 'Поддерживается форматирование текста, списки, ссылки и цвета'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Канал рассылки</Label>
              <select
                id="channel"
                value={formData.channel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    channel: e.target.value as 'telegram' | 'sms' | 'email',
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="telegram">📱 Telegram</option>
                <option value="sms">💬 SMS</option>
                <option value="email">📧 Email</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Получатели</Label>
              <select
                id="role"
                value={formData.role || 'client'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as 'client' | 'admin' | 'master',
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="client">Все клиенты</option>
                <option value="master">Все мастера</option>
                <option value="admin">Все администраторы</option>
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormData({ title: '', message: '', channel: 'telegram', role: 'client' });
                }}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить рассылку
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

