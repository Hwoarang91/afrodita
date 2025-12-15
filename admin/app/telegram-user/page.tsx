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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, MessageSquare, Image, Video, File, Loader2, Shield, Trash2 } from 'lucide-react';

interface SessionInfo {
  id: string;
  phoneNumber: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function TelegramUserPage() {
  const [selectedTab, setSelectedTab] = useState<'send' | 'sessions'>('send');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'photo' | 'video' | 'document'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const queryClient = useQueryClient();

  // Получение списка чатов
  const { data: chatsData, isLoading: isLoadingChats } = useQuery({
    queryKey: ['telegram-user-chats'],
    queryFn: async () => {
      const response = await apiClient.get('/telegram/user/chats?type=all');
      return response.data;
    },
    retry: false,
  });

  // Отправка текстового сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { chatId: string; message: string; parseMode?: string }) => {
      return await apiClient.post('/telegram/user/send-message', data);
    },
    onSuccess: () => {
      toast.success('Сообщение отправлено');
      setMessage('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отправке сообщения');
    },
  });

  // Отправка медиа
  const sendMediaMutation = useMutation({
    mutationFn: async (data: {
      chatId: string;
      mediaType: 'photo' | 'video' | 'document';
      mediaUrl: string;
      caption?: string;
    }) => {
      return await apiClient.post('/telegram/user/send-media', data);
    },
    onSuccess: () => {
      toast.success('Медиа отправлено');
      setMediaUrl('');
      setCaption('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отправке медиа');
    },
  });

  // Получение списка сессий
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['telegram-user-sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/telegram/user/sessions');
      return response.data;
    },
    retry: false,
  });

  // Деактивация сессии
  const deactivateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiClient.delete(`/telegram/user/sessions/${sessionId}`);
    },
    onSuccess: () => {
      toast.success('Сессия деактивирована');
      queryClient.invalidateQueries({ queryKey: ['telegram-user-sessions'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при деактивации сессии');
    },
  });

  // Деактивация всех других сессий
  const deactivateOtherSessionsMutation = useMutation({
    mutationFn: async (keepSessionId?: string) => {
      const url = keepSessionId
        ? `/telegram/user/sessions?keepSessionId=${keepSessionId}`
        : '/telegram/user/sessions';
      return await apiClient.delete(url);
    },
    onSuccess: () => {
      toast.success('Все другие сессии деактивированы');
      queryClient.invalidateQueries({ queryKey: ['telegram-user-sessions'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при деактивации сессий');
    },
  });

  const handleSend = () => {
    if (!selectedChatId) {
      toast.error('Выберите получателя');
      return;
    }

    if (mediaType === 'text') {
      if (!message) {
        toast.error('Введите сообщение');
        return;
      }
      sendMessageMutation.mutate({
        chatId: selectedChatId,
        message,
        parseMode: 'HTML',
      });
    } else {
      if (!mediaUrl) {
        toast.error('Введите URL медиа');
        return;
      }
      sendMediaMutation.mutate({
        chatId: selectedChatId,
        mediaType: mediaType as 'photo' | 'video' | 'document',
        mediaUrl,
        caption: caption || undefined,
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Мои сообщения Telegram</h1>

      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as 'send' | 'sessions')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="send">
            <Send className="w-4 h-4 mr-2" />
            Отправка сообщений
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Shield className="w-4 h-4 mr-2" />
            Управление сессиями
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <Card className="mb-6">
        <CardHeader>
          <CardTitle>Выбор получателя</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingChats ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span>Загрузка чатов...</span>
            </div>
          ) : chatsData?.chats?.length > 0 ? (
            <Select value={selectedChatId} onValueChange={setSelectedChatId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите чат" />
              </SelectTrigger>
              <SelectContent>
                {chatsData.chats.map((chat: any) => (
                  <SelectItem key={chat.id} value={chat.id}>
                    {chat.title} ({chat.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Нет доступных чатов. Убедитесь, что вы авторизованы через Telegram.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Отправка сообщения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Тип сообщения</Label>
            <div className="flex space-x-2 mt-2">
              <Button
                variant={mediaType === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType('text')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Текст
              </Button>
              <Button
                variant={mediaType === 'photo' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType('photo')}
              >
                <Image className="w-4 h-4 mr-2" />
                Фото
              </Button>
              <Button
                variant={mediaType === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType('video')}
              >
                <Video className="w-4 h-4 mr-2" />
                Видео
              </Button>
              <Button
                variant={mediaType === 'document' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaType('document')}
              >
                <File className="w-4 h-4 mr-2" />
                Документ
              </Button>
            </div>
          </div>

          {mediaType === 'text' ? (
            <div>
              <Label htmlFor="message">Сообщение</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Введите текст сообщения..."
                className="mt-2"
              />
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="mediaUrl">URL или file_id медиа</Label>
                <Input
                  id="mediaUrl"
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg или file_id"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="caption">Подпись (опционально)</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  placeholder="Подпись к медиа..."
                  className="mt-2"
                />
              </div>
            </>
          )}

          <Button
            onClick={handleSend}
            disabled={
              sendMessageMutation.isPending ||
              sendMediaMutation.isPending ||
              !selectedChatId ||
              (mediaType === 'text' ? !message : !mediaUrl)
            }
            className="w-full"
          >
            {(sendMessageMutation.isPending || sendMediaMutation.isPending) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Отправить
              </>
            )}
          </Button>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Активные сессии Telegram</CardTitle>
                {sessionsData?.sessions?.length > 1 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const currentSession = sessionsData?.sessions?.[0];
                      if (currentSession) {
                        deactivateOtherSessionsMutation.mutate(currentSession.id);
                      } else {
                        deactivateOtherSessionsMutation.mutate(undefined);
                      }
                    }}
                    disabled={deactivateOtherSessionsMutation.isPending}
                  >
                    {deactivateOtherSessionsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Деактивация...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Деактивировать все другие
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>Загрузка сессий...</span>
                </div>
              ) : sessionsData?.sessions?.length > 0 ? (
                <div className="space-y-4">
                  {sessionsData.sessions.map((session: SessionInfo, index: number) => (
                    <Card key={session.id} className={index === 0 ? 'border-primary' : ''}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={index === 0 ? 'default' : 'secondary'}>
                                {index === 0 ? 'Текущая сессия' : 'Активная сессия'}
                              </Badge>
                              {session.phoneNumber && (
                                <span className="text-sm text-muted-foreground">
                                  {session.phoneNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-sm space-y-1">
                              {session.ipAddress && (
                                <div>
                                  <span className="text-muted-foreground">IP:</span> {session.ipAddress}
                                </div>
                              )}
                              {session.userAgent && (
                                <div>
                                  <span className="text-muted-foreground">Устройство:</span>{' '}
                                  {session.userAgent.length > 60
                                    ? `${session.userAgent.substring(0, 60)}...`
                                    : session.userAgent}
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Создана:</span>{' '}
                                {formatDate(session.createdAt)}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Последнее использование:</span>{' '}
                                {formatDate(session.lastUsedAt)}
                              </div>
                            </div>
                          </div>
                          {index !== 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deactivateSessionMutation.mutate(session.id)}
                              disabled={deactivateSessionMutation.isPending}
                            >
                              {deactivateSessionMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Деактивировать
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Нет активных сессий. Авторизуйтесь через Telegram для создания сессии.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

