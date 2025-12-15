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
import { Trash2, Edit, Plus, CheckCircle2, XCircle } from 'lucide-react';

interface AutoReply {
  id: string;
  keyword: string;
  response: string;
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  caseSensitive: boolean;
  isActive: boolean;
  chatType: 'all' | 'private' | 'group' | 'supergroup' | 'channel' | null;
  chatId: string | null;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function AutoRepliesManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<AutoReply | null>(null);
  const queryClient = useQueryClient();

  const { data: autoReplies, isLoading } = useQuery({
    queryKey: ['auto-replies'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/auto-replies');
      return data as AutoReply[];
    },
  });

  const [formData, setFormData] = useState({
    keyword: '',
    response: '',
    matchType: 'contains' as AutoReply['matchType'],
    caseSensitive: false,
    isActive: true,
    chatType: 'all' as AutoReply['chatType'],
    chatId: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiClient.post('/telegram/auto-replies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      setIsDialogOpen(false);
      setFormData({
        keyword: '',
        response: '',
        matchType: 'contains',
        caseSensitive: false,
        isActive: true,
        chatType: 'all',
        chatId: '',
      });
      toast.success('Автоматический ответ создан');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при создании автоматического ответа');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiClient.put(`/telegram/auto-replies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      setIsDialogOpen(false);
      setEditingReply(null);
      toast.success('Автоматический ответ обновлен');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении автоматического ответа');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/telegram/auto-replies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Автоматический ответ удален');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при удалении автоматического ответа');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiClient.put(`/telegram/auto-replies/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Статус автоматического ответа обновлен');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении статуса');
    },
  });

  const handleCreate = () => {
    setEditingReply(null);
    setFormData({
      keyword: '',
      response: '',
      matchType: 'contains',
      caseSensitive: false,
      isActive: true,
      chatType: 'all',
      chatId: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (reply: AutoReply) => {
    setEditingReply(reply);
    setFormData({
      keyword: reply.keyword,
      response: reply.response,
      matchType: reply.matchType,
      caseSensitive: reply.caseSensitive,
      isActive: reply.isActive,
      chatType: reply.chatType || 'all',
      chatId: reply.chatId || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.keyword || !formData.response) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    const data = {
      ...formData,
      chatId: formData.chatId || null,
    };

    if (editingReply) {
      updateMutation.mutate({ id: editingReply.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getMatchTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      exact: 'Точное совпадение',
      contains: 'Содержит',
      startsWith: 'Начинается с',
      endsWith: 'Заканчивается на',
      regex: 'Регулярное выражение',
    };
    return labels[type] || type;
  };

  const getChatTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      all: 'Все чаты',
      private: 'Личные чаты',
      group: 'Группы',
      supergroup: 'Супергруппы',
      channel: 'Каналы',
    };
    return labels[type || 'all'] || type;
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
          <h2 className="text-xl font-semibold text-foreground">Автоматические ответы</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Настройте автоматические ответы бота на ключевые слова и фразы
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Создать правило
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {autoReplies?.map((reply) => (
          <Card key={reply.id} className={reply.isActive ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{reply.keyword}</CardTitle>
                <div className="flex items-center gap-2">
                  {reply.isActive ? (
                    <Badge variant="default">Активно</Badge>
                  ) : (
                    <Badge variant="secondary">Неактивно</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Ответ:</strong> {reply.response.substring(0, 50)}
                  {reply.response.length > 50 ? '...' : ''}
                </p>
                <p>
                  <strong>Тип совпадения:</strong> {getMatchTypeLabel(reply.matchType)}
                </p>
                <p>
                  <strong>Тип чата:</strong> {getChatTypeLabel(reply.chatType)}
                </p>
                {reply.caseSensitive && (
                  <p>
                    <strong>Учитывать регистр:</strong> Да
                  </p>
                )}
                <p>
                  <strong>Использовано:</strong> {reply.usageCount} раз
                </p>
                {reply.lastUsedAt && (
                  <p>
                    <strong>Последнее использование:</strong>{' '}
                    {new Date(reply.lastUsedAt).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(reply)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Редактировать
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toggleActiveMutation.mutate({ id: reply.id, isActive: !reply.isActive })
                  }
                  disabled={toggleActiveMutation.isPending}
                >
                  {reply.isActive ? (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Деактивировать
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Активировать
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Вы уверены, что хотите удалить это правило?')) {
                      deleteMutation.mutate(reply.id);
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
        ))}
      </div>

      {autoReplies?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Нет автоматических ответов</p>
            <Button onClick={handleCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Создать первое правило
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Редактировать автоматический ответ' : 'Создать автоматический ответ'}
            </DialogTitle>
            <DialogDescription>
              Настройте правило для автоматического ответа бота на ключевые слова
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="keyword">Ключевое слово или фраза *</Label>
              <Input
                id="keyword"
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                placeholder="Например: привет, цена, запись"
              />
            </div>

            <div>
              <Label htmlFor="response">Ответ *</Label>
              <Textarea
                id="response"
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                rows={5}
                placeholder="Текст ответа бота..."
              />
            </div>

            <div>
              <Label htmlFor="matchType">Тип совпадения</Label>
              <select
                id="matchType"
                value={formData.matchType}
                onChange={(e) =>
                  setFormData({ ...formData, matchType: e.target.value as AutoReply['matchType'] })
                }
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
              >
                <option value="exact">Точное совпадение</option>
                <option value="contains">Содержит</option>
                <option value="startsWith">Начинается с</option>
                <option value="endsWith">Заканчивается на</option>
                <option value="regex">Регулярное выражение</option>
              </select>
            </div>

            <div>
              <Label htmlFor="chatType">Тип чата</Label>
              <select
                id="chatType"
                value={formData.chatType || 'all'}
                onChange={(e) =>
                  setFormData({ ...formData, chatType: e.target.value as AutoReply['chatType'] })
                }
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
              >
                <option value="all">Все чаты</option>
                <option value="private">Личные чаты</option>
                <option value="group">Группы</option>
                <option value="supergroup">Супергруппы</option>
                <option value="channel">Каналы</option>
              </select>
            </div>

            <div>
              <Label htmlFor="chatId">ID конкретного чата (опционально)</Label>
              <Input
                id="chatId"
                value={formData.chatId}
                onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                placeholder="Оставьте пустым для всех чатов выбранного типа"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="caseSensitive"
                checked={formData.caseSensitive}
                onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
              />
              <Label htmlFor="caseSensitive">Учитывать регистр</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <Label htmlFor="isActive">Активно</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingReply ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

