'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ExportButton } from '../components/ExportButton';
import { exportAppointments } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  client: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  master: {
    name: string;
  };
  service: {
    name: string;
  };
}

export default function AppointmentsPage() {
  // По умолчанию показываем сегодняшнюю дату
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [filters, setFilters] = useState({
    status: '',
    masterId: '',
    clientSearch: '',
  });
  const queryClient = useQueryClient();
  const [cancelModal, setCancelModal] = useState<{ open: boolean; appointmentId: string | null; reason: string }>({
    open: false,
    appointmentId: null,
    reason: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Загружаем список мастеров для фильтра
  const { data: mastersData } = useQuery({
    queryKey: ['masters'],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters');
      // API теперь возвращает объект с пагинацией { data: [], total, page, limit, totalPages }
      return Array.isArray(data) ? data : (data?.data || []);
    },
  });
  
  const masters = Array.isArray(mastersData) ? mastersData : (mastersData?.data || []);

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['appointments', selectedDate.toISOString(), filters],
    queryFn: async () => {
      try {
        // Форматируем дату в формате YYYY-MM-DD для корректной фильтрации
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const { data } = await apiClient.get('/appointments', {
          params: {
            date: dateStr,
            status: filters.status || undefined,
            masterId: filters.masterId || undefined,
          },
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('Загружены записи для даты', dateStr, ':', data);
        }
        
        // Фильтруем по клиенту на клиенте (если указан поиск)
        let filtered = data || [];
        if (filters.clientSearch) {
          const searchLower = filters.clientSearch.toLowerCase();
          filtered = filtered.filter((apt: Appointment) => {
            const fullName = `${apt.client.firstName} ${apt.client.lastName}`.toLowerCase();
            const phone = apt.client.phone?.toLowerCase() || '';
            return fullName.includes(searchLower) || phone.includes(searchLower);
          });
        }
        
        return filtered;
      } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Ошибка при загрузке записей:', error);
        }
        throw error;
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/appointments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/appointments/${id}/confirm`);
    },
    onMutate: async (id) => {
      // Отменяем текущие запросы
      await queryClient.cancelQueries({ queryKey: ['appointments', selectedDate.toISOString(), filters] });
      
      // Сохраняем предыдущее состояние
      const previousAppointments = queryClient.getQueryData(['appointments', selectedDate.toISOString(), filters]);
      
      // Оптимистично обновляем UI
      queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === id ? { ...apt, status: 'confirmed' } : apt
        );
      });
      
      return { previousAppointments };
    },
    onError: (error: any, id, context) => {
      // Откатываем изменения при ошибке
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], context.previousAppointments);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: () => {
      if (typeof window !== 'undefined' && (window as any).showSuccessToast) {
        (window as any).showSuccessToast('Запись подтверждена. Клиенту отправлено уведомление.');
      }
    },
    onSettled: () => {
      // Обновляем данные с сервера
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await apiClient.post(`/appointments/${id}/cancel-admin`, { reason });
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', selectedDate.toISOString(), filters] });
      const previousAppointments = queryClient.getQueryData(['appointments', selectedDate.toISOString(), filters]);
      
      queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === id ? { ...apt, status: 'cancelled' } : apt
        );
      });
      
      return { previousAppointments };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], context.previousAppointments);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: () => {
      setCancelModal({ open: false, appointmentId: null, reason: '' });
      if (typeof window !== 'undefined' && (window as any).showSuccessToast) {
        (window as any).showSuccessToast('Запись отменена. Клиенту отправлено уведомление.');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/appointments/${id}/delete`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', selectedDate.toISOString(), filters] });
      const previousAppointments = queryClient.getQueryData(['appointments', selectedDate.toISOString(), filters]);
      
      // Удаляем из списка сразу
      queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], (old: any) => {
        if (!old) return old;
        return old.filter((apt: Appointment) => apt.id !== id);
      });
      
      return { previousAppointments };
    },
    onError: (error: any, id, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments', selectedDate.toISOString(), filters], context.previousAppointments);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: () => {
      setDeleteConfirm(null);
      if (typeof window !== 'undefined' && (window as any).showSuccessToast) {
        (window as any).showSuccessToast('Запись удалена');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Подтверждена', variant: 'default' as const, icon: CheckCircle2 },
      cancelled: { label: 'Отменена', variant: 'destructive' as const, icon: XCircle },
      completed: { label: 'Завершена', variant: 'secondary' as const, icon: CheckCircle2 },
      pending: { label: 'Не подтверждена', variant: 'outline' as const, icon: Clock },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'outline' as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="h-5 w-5" />
            <p>Ошибка при загрузке записей: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const exportData = appointments ? exportAppointments(appointments) : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Записи</h1>
          <p className="text-muted-foreground mt-1">
            Управление записями клиентов
          </p>
        </div>
        {appointments && appointments.length > 0 && (
          <ExportButton
            data={exportData}
            filename="appointments"
            title="Записи"
            headers={exportData[0]}
          />
        )}
      </div>
        
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Настройте параметры поиска записей</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Фильтр по дате */}
            <div>
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
              />
            </div>
            
            {/* Фильтр по статусу */}
            <div>
              <Label htmlFor="status">Статус</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Все статусы</option>
                <option value="pending">Не подтверждена</option>
                <option value="confirmed">Подтверждена</option>
                <option value="completed">Завершена</option>
                <option value="cancelled">Отменена</option>
              </select>
            </div>
            
            {/* Фильтр по мастеру */}
            <div>
              <Label htmlFor="master">Мастер</Label>
              <select
                id="master"
                value={filters.masterId}
                onChange={(e) => setFilters({ ...filters, masterId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Все мастера</option>
                {masters?.map((master: any) => (
                  <option key={master.id} value={master.id}>
                    {master.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Поиск по клиенту */}
            <div>
              <Label htmlFor="clientSearch">Поиск клиента</Label>
              <Input
                id="clientSearch"
                type="text"
                placeholder="Имя или телефон..."
                value={filters.clientSearch}
                onChange={(e) => setFilters({ ...filters, clientSearch: e.target.value })}
              />
            </div>
          </div>
          
          {/* Кнопка сброса фильтров */}
          {(filters.status || filters.masterId || filters.clientSearch) && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ status: '', masterId: '', clientSearch: '' })}
              >
                Сбросить фильтры
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список записей</CardTitle>
          <CardDescription>
            {appointments?.length || 0} {appointments?.length === 1 ? 'запись' : 'записей'} на {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(!appointments || appointments.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              Нет записей на выбранную дату
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Мастер</TableHead>
                    <TableHead>Услуга</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt: Appointment) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        {format(new Date(apt.startTime), 'HH:mm', { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{apt.client.firstName} {apt.client.lastName}</div>
                          {apt.client.phone && (
                            <div className="text-sm text-muted-foreground">{apt.client.phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{apt.master.name}</TableCell>
                      <TableCell>{apt.service.name}</TableCell>
                      <TableCell className="font-semibold">{apt.price} ₽</TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {apt.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                confirmMutation.mutate(apt.id);
                              }}
                              disabled={confirmMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Подтвердить
                            </Button>
                          )}
                          {apt.status === 'confirmed' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: apt.id, status: 'completed' })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Завершить
                            </Button>
                          )}
                          {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCancelModal({ open: true, appointmentId: apt.id, reason: '' });
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Отменить
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setDeleteConfirm(apt.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelModal.open} onOpenChange={(open) => {
        if (!open) {
          setCancelModal({ open: false, appointmentId: null, reason: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить запись</DialogTitle>
            <DialogDescription>
              Укажите причину отмены (необязательно). Клиент получит уведомление в Telegram.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Причина отмены</Label>
              <Textarea
                id="reason"
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal({ ...cancelModal, reason: e.target.value })
                }
                placeholder="Причина отмены (необязательно)..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelModal({ open: false, appointmentId: null, reason: '' });
              }}
            >
              Закрыть
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                cancelMutation.mutate({
                  id: cancelModal.appointmentId!,
                  reason: cancelModal.reason.trim() || undefined,
                });
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Отмена...' : 'Отменить запись'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirm(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить запись?</DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Запись будет удалена безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

