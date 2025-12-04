'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WorkSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BlockInterval {
  id: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

interface Master {
  id: string;
  name: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 7, label: 'Воскресенье' },
];

export default function MasterSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const masterId = params.id as string;
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const queryClient = useQueryClient();

  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '18:00',
    isActive: true,
  });

  const [blockForm, setBlockForm] = useState({
    startTime: '',
    endTime: '',
    reason: '',
  });

  const { data: master } = useQuery({
    queryKey: ['master', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/masters/${masterId}`);
      return data;
    },
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['master-schedule', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/masters/${masterId}/schedule`);
      return data || [];
    },
  });

  const { data: blockIntervals, isLoading: blocksLoading } = useQuery({
    queryKey: ['master-block-intervals', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/masters/${masterId}/block-intervals`);
      return data || [];
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiClient.post(`/masters/${masterId}/schedule`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] });
      setIsScheduleModalOpen(false);
      setScheduleForm({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true });
      toast.success('Расписание добавлено');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiClient.put(`/masters/schedule/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] });
      setIsScheduleModalOpen(false);
      setEditingSchedule(null);
      toast.success('Расписание обновлено');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/masters/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] });
      toast.success('Расписание удалено');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiClient.post(`/masters/${masterId}/block-intervals`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-block-intervals'] });
      setIsBlockModalOpen(false);
      setBlockForm({ startTime: '', endTime: '', reason: '' });
      toast.success('Интервал заблокирован');
    },
    onError: (error: any) => {
      // Ошибка уже обработана в API interceptor
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/masters/block-intervals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-block-intervals'] });
      toast.success('Блокировка удалена');
    },
  });

  const handleEditSchedule = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
    });
    setIsScheduleModalOpen(true);
  };

  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data: scheduleForm });
    } else {
      createScheduleMutation.mutate(scheduleForm);
    }
  };

  const handleSubmitBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.startTime || !blockForm.endTime) {
      toast.warning('Заполните время начала и окончания');
      return;
    }
    createBlockMutation.mutate(blockForm);
  };

  if (schedulesLoading || blocksLoading) {
    return <div className="p-8">Загрузка...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/masters" className="text-primary-600 hover:text-primary-700 mb-2 inline-block">
          ← Назад к списку мастеров
        </Link>
        <h1 className="text-3xl font-bold text-foreground">
          Расписание мастера: {master?.name || 'Загрузка...'}
        </h1>
      </div>

      {/* Расписание работы */}
      <div className="bg-card rounded-lg shadow mb-6 border border-border">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Расписание работы</h2>
          <Button
            onClick={() => {
              setEditingSchedule(null);
              setScheduleForm({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true });
              setIsScheduleModalOpen(true);
            }}
          >
            + Добавить расписание
          </Button>
        </div>
        <div className="p-6">
          {schedules && schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules.map((schedule: WorkSchedule) => {
                const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek);
                return (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-semibold w-32 text-foreground">{day?.label || 'Неизвестно'}</div>
                      <div className="text-muted-foreground">
                        {schedule.startTime} - {schedule.endTime}
                      </div>
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Активно' : 'Неактивно'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditSchedule(schedule)}
                        variant="outline"
                        size="sm"
                      >
                        Редактировать
                      </Button>
                      <Button
                        onClick={() => {
                          deleteScheduleMutation.mutate(schedule.id);
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Расписание не настроено</div>
          )}
        </div>
      </div>

      {/* Заблокированные интервалы */}
      <div className="bg-card rounded-lg shadow border border-border">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Заблокированные интервалы</h2>
          <Button
            onClick={() => setIsBlockModalOpen(true)}
            variant="default"
            className="bg-orange-600 hover:bg-orange-700"
          >
            + Заблокировать интервал
          </Button>
        </div>
        <div className="p-6">
          {blockIntervals && blockIntervals.length > 0 ? (
            <div className="space-y-2">
              {blockIntervals.map((block: BlockInterval) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {new Date(block.startTime).toLocaleString('ru-RU')} -{' '}
                      {new Date(block.endTime).toLocaleString('ru-RU')}
                    </div>
                    {block.reason && <div className="text-sm text-muted-foreground mt-1">{block.reason}</div>}
                  </div>
                  <Button
                    onClick={() => {
                      deleteBlockMutation.mutate(block.id);
                    }}
                    variant="destructive"
                    size="sm"
                  >
                    Удалить
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Нет заблокированных интервалов</div>
          )}
        </div>
      </div>

      {/* Модальное окно для расписания */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Редактировать расписание' : 'Добавить расписание'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitSchedule} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">День недели</Label>
              <select
                id="dayOfWeek"
                value={scheduleForm.dayOfWeek}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, dayOfWeek: Number(e.target.value) })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Время начала</Label>
              <Input
                id="startTime"
                type="time"
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Время окончания</Label>
              <Input
                id="endTime"
                type="time"
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={scheduleForm.isActive}
                onChange={(e) => setScheduleForm({ ...scheduleForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Активно
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setEditingSchedule(null);
                }}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
              >
                {editingSchedule ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Модальное окно для блокировки */}
      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заблокировать интервал</DialogTitle>
            <DialogDescription>
              Заблокируйте время, когда мастер не будет доступен для записи
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blockStartTime">Дата и время начала</Label>
              <Input
                id="blockStartTime"
                type="datetime-local"
                value={blockForm.startTime}
                onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockEndTime">Дата и время окончания</Label>
              <Input
                id="blockEndTime"
                type="datetime-local"
                value={blockForm.endTime}
                onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockReason">Причина (необязательно)</Label>
              <Textarea
                id="blockReason"
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                rows={3}
                placeholder="Например: Выходной, Отпуск, Болезнь..."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsBlockModalOpen(false);
                  setBlockForm({ startTime: '', endTime: '', reason: '' });
                }}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createBlockMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Заблокировать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

