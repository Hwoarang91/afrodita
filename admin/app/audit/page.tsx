'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  changes: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const { data } = await apiClient.get('/audit/logs', { params });
      return data;
    },
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      user_created: 'Создание пользователя',
      user_updated: 'Обновление пользователя',
      user_deleted: 'Удаление пользователя',
      master_created: 'Создание мастера',
      master_updated: 'Обновление мастера',
      master_deleted: 'Удаление мастера',
      service_created: 'Создание услуги',
      service_updated: 'Обновление услуги',
      service_deleted: 'Удаление услуги',
      appointment_created: 'Создание записи',
      appointment_updated: 'Обновление записи',
      appointment_deleted: 'Удаление записи',
      appointment_confirmed: 'Подтверждение записи',
      appointment_cancelled: 'Отмена записи',
      settings_updated: 'Обновление настроек',
      broadcast_sent: 'Отправка рассылки',
      schedule_created: 'Создание расписания',
      schedule_updated: 'Обновление расписания',
      schedule_deleted: 'Удаление расписания',
      block_interval_created: 'Создание блокировки',
      block_interval_deleted: 'Удаление блокировки',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('updated')) return 'bg-blue-100 text-blue-800';
    if (action.includes('deleted')) return 'bg-red-100 text-red-800';
    if (action.includes('confirmed')) return 'bg-green-100 text-green-800';
    if (action.includes('cancelled')) return 'bg-orange-100 text-orange-800';
    return 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return <div className="space-y-4">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Журнал действий</h1>
        <p className="text-muted-foreground mt-1">История всех действий в системе</p>
      </div>

      {/* Фильтры */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Действие</Label>
              <select
                id="action"
                value={filters.action}
                onChange={(e) => {
                  setFilters({ ...filters, action: e.target.value });
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Все действия</option>
                <option value="user_created">Создание пользователя</option>
                <option value="user_updated">Обновление пользователя</option>
                <option value="user_deleted">Удаление пользователя</option>
                <option value="master_created">Создание мастера</option>
                <option value="master_updated">Обновление мастера</option>
                <option value="master_deleted">Удаление мастера</option>
                <option value="service_created">Создание услуги</option>
                <option value="service_updated">Обновление услуги</option>
                <option value="service_deleted">Удаление услуги</option>
                <option value="settings_updated">Обновление настроек</option>
                <option value="broadcast_sent">Отправка рассылки</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entityType">Тип сущности</Label>
              <select
                id="entityType"
                value={filters.entityType}
                onChange={(e) => {
                  setFilters({ ...filters, entityType: e.target.value });
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Все типы</option>
                <option value="user">Пользователь</option>
                <option value="master">Мастер</option>
                <option value="service">Услуга</option>
                <option value="appointment">Запись</option>
                <option value="settings">Настройки</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Начальная дата</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Конечная дата</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ action: '', entityType: '', startDate: '', endDate: '' });
                setPage(1);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Сбросить фильтры
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Таблица логов */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>IP адрес</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs?.map((log: AuditLog) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {log.user ? (
                      <div>
                        <div className="font-medium">
                          {log.user.firstName} {log.user.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Система</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.action.includes('created') || log.action.includes('confirmed')
                          ? 'default'
                          : log.action.includes('deleted')
                          ? 'destructive'
                          : log.action.includes('cancelled')
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>{log.description}</div>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Изменения
                        </summary>
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                            <div key={key} className="mb-1">
                              <span className="font-medium">{key}:</span>{' '}
                              <span className="text-destructive">{JSON.stringify(value.old)}</span> →{' '}
                              <span className="text-green-600">{JSON.stringify(value.new)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {log.ipAddress || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Пагинация */}
        {data && data.total > limit && (
          <div className="px-6 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-muted-foreground">
              Показано {((page - 1) * limit) + 1} - {Math.min(page * limit, data.total)} из {data.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page + 1)}
                disabled={page * limit >= data.total}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {(!data?.logs || data.logs.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">Логи не найдены</div>
        )}
      </Card>
    </div>
  );
}

