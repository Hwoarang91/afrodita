'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, Eye, FileCode } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Template {
  id: string;
  name: string;
  type: string;
  channel: string;
  subject: string;
  body: string;
  variables?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTIFICATION_TYPES = [
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_REMINDER',
  'BONUS_EARNED',
  'FEEDBACK_REQUEST',
  'BIRTHDAY_GREETING',
  'MARKETING',
];

const NOTIFICATION_CHANNELS = ['TELEGRAM', 'SMS', 'EMAIL'];

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/templates');
      return data;
    },
  });

  const { data: variables } = useQuery({
    queryKey: ['template-variables', editingTemplate?.type],
    queryFn: async () => {
      if (!editingTemplate?.type) return { variables: [] };
      const { data } = await apiClient.get(`/templates/variables/${editingTemplate.type}`);
      return data;
    },
    enabled: !!editingTemplate?.type,
  });

  const createMutation = useMutation({
    mutationFn: async (template: Partial<Template>) => {
      const { data } = await apiClient.post('/templates', template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast.success('Шаблон создан');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при создании шаблона');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...template }: Partial<Template> & { id: string }) => {
      const { data } = await apiClient.put(`/templates/${id}`, template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast.success('Шаблон обновлен');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении шаблона');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Шаблон удален');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при удалении шаблона');
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ id, sampleData }: { id: string; sampleData: Record<string, any> }) => {
      const { data } = await apiClient.post(`/templates/${id}/preview`, { sampleData });
      return data;
    },
  });

  const handleCreate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      type: 'APPOINTMENT_CONFIRMED',
      channel: 'TELEGRAM',
      subject: '',
      body: '',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handlePreview = async (template: Template) => {
    setPreviewTemplate(template);
    // Генерируем тестовые данные на основе переменных
    const testData: Record<string, any> = {};
    if (template.variables) {
      template.variables.forEach((varName) => {
        if (varName.includes('Name')) {
          testData[varName] = 'Тестовое имя';
        } else if (varName.includes('Time') || varName.includes('Date')) {
          testData[varName] = new Date().toLocaleString('ru-RU');
        } else if (varName.includes('price') || varName.includes('Price')) {
          testData[varName] = '1000';
        } else if (varName.includes('points') || varName.includes('Points')) {
          testData[varName] = '100';
        } else {
          testData[varName] = 'Тестовое значение';
        }
      });
    }
    setPreviewData(testData);
    await previewMutation.mutateAsync({ id: template.id, sampleData: testData });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    if (editingTemplate.id) {
      updateMutation.mutate({ id: editingTemplate.id, ...editingTemplate });
    } else {
      createMutation.mutate(editingTemplate);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Шаблоны сообщений</h1>
          <p className="text-muted-foreground mt-1">
            Управление шаблонами уведомлений для различных ситуаций
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Создать шаблон
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template: Template) => (
          <Card key={template.id} className="transition-colors hover:bg-accent/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant="outline" className="mr-2">
                      {template.type}
                    </Badge>
                    <Badge variant="secondary">{template.channel}</Badge>
                  </CardDescription>
                </div>
                {template.isActive ? (
                  <Badge variant="default">Активен</Badge>
                ) : (
                  <Badge variant="secondary">Неактивен</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {template.subject || template.body.substring(0, 100)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Редактировать
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(template)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Предпросмотр
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    deleteMutation.mutate(template.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог создания/редактирования */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? 'Редактировать шаблон' : 'Создать шаблон'}
            </DialogTitle>
            <DialogDescription>
              Используйте переменные в формате {'{{variableName}}'} для подстановки данных
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={editingTemplate?.name || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate!, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Тип уведомления</Label>
                  <select
                    id="type"
                    value={editingTemplate?.type || ''}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate!, type: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    {NOTIFICATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="channel">Канал</Label>
                  <select
                    id="channel"
                    value={editingTemplate?.channel || ''}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate!, channel: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {variables?.variables && variables.variables.length > 0 && (
                <div>
                  <Label>Доступные переменные</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {variables.variables.map((varName: string) => (
                      <Badge
                        key={varName}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                          const currentBody = editingTemplate?.body || '';
                          setEditingTemplate({
                            ...editingTemplate!,
                            body: currentBody + ` {{${varName}}}`,
                          });
                        }}
                      >
                        {varName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="subject">Тема/Заголовок</Label>
                <Input
                  id="subject"
                  value={editingTemplate?.subject || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate!, subject: e.target.value })
                  }
                  placeholder="Например: {{serviceName}} - подтверждение записи"
                />
              </div>
              <div>
                <Label htmlFor="body">Тело сообщения</Label>
                <Textarea
                  id="body"
                  value={editingTemplate?.body || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate!, body: e.target.value })
                  }
                  rows={10}
                  placeholder="Например: Уважаемый {{clientName}}, ваша запись на {{serviceName}} к {{masterName}} подтверждена на {{startTime}}"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingTemplate?.isActive ?? true}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate!, isActive: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Активен
                </Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingTemplate(null);
                }}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Сохранение...'
                  : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог предпросмотра */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр шаблона</DialogTitle>
            <DialogDescription>
              {previewTemplate?.name} ({previewTemplate?.type} - {previewTemplate?.channel})
            </DialogDescription>
          </DialogHeader>
          {previewMutation.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Тема:</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  {previewMutation.data?.subject || previewTemplate?.subject}
                </div>
              </div>
              <div>
                <Label>Сообщение:</Label>
                <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">
                  {previewMutation.data?.body || previewTemplate?.body}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

