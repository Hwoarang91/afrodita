'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTelegramSession } from '@/lib/hooks/useTelegramSession';
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
import { Send, MessageSquare, Image, Video, File, Loader2, Shield, Trash2, X } from 'lucide-react';

interface SessionInfo {
  id: string;
  phoneNumber: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  status: 'active' | 'invalid' | 'revoked' | 'initializing';
  invalidReason?: string | null;
  dcId?: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  userId?: string | null;
  userEmail?: string | null;
  isCurrent?: boolean;
}


export default function TelegramUserMessagesTab() {
  const [selectedTab, setSelectedTab] = useState<'send' | 'sessions'>('send');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'photo' | 'video' | 'document'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const queryClient = useQueryClient();

  // КРИТИЧНО: Проверяем статус Telegram сессии перед загрузкой данных
  const { data: sessionStatus, isLoading: isLoadingSession } = useTelegramSession();
  
  // Определяем, можем ли мы загружать Telegram данные
  const canLoadTelegramData = Boolean(sessionStatus?.hasSession && sessionStatus.status === 'active');

  // Получение списка чатов - ТОЛЬКО если сессия active
  const { data: chatsData, isLoading: isLoadingChats, error: chatsError } = useQuery({
    queryKey: ['telegram-user-chats'],
    queryFn: async () => {
      const response = await apiClient.get('/telegram/user/chats?type=all');
      return response.data;
    },
    enabled: canLoadTelegramData, // КРИТИЧНО: Загружаем только когда сессия active
    retry: false,
  });

  // Обработка ошибок чатов
  useEffect(() => {
    if (chatsError) {
      const error: any = chatsError;
      if (error.response?.status === 401) {
        if (error.response?.data?.message?.includes('No active Telegram session')) {
          // Показываем понятное сообщение пользователю
          toast.error('Сначала необходимо создать Telegram сессию. Перейдите на вкладку "Авторизация" и авторизуйтесь через телефон или QR-код.');
          return;
        }
        // Другая ошибка 401 - возможно, не авторизован в Telegram
        console.warn('Unauthorized access to Telegram chats. User may need to login to Telegram.');
      }
    }
  }, [chatsError]);

  // Получение списка контактов - ТОЛЬКО если сессия active
  const { data: contactsData, isLoading: isLoadingContacts, error: contactsError } = useQuery({
    queryKey: ['telegram-user-contacts'],
    queryFn: async () => {
      const response = await apiClient.get('/telegram/user/contacts');
      return response.data;
    },
    enabled: canLoadTelegramData, // КРИТИЧНО: Загружаем только когда сессия active
    retry: false,
  });

  // Обработка ошибок контактов
  useEffect(() => {
    if (contactsError) {
      const error: any = contactsError;
      if (error.response?.status === 401) {
        if (error.response?.data?.message?.includes('No active Telegram session')) {
          // Показываем понятное сообщение пользователю
          toast.error('Сначала необходимо создать Telegram сессию. Перейдите на вкладку "Авторизация" и авторизуйтесь через телефон или QR-код.');
          return;
        }
        // Другая ошибка 401 - возможно, не авторизован в админ-панели
        console.warn('Unauthorized access to Telegram contacts. User may need to login to Telegram.');
      }
    }
  }, [contactsError]);

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

  // Получение списка сессий (для просмотра - не требует active сессии)
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['telegram-user-sessions'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/telegram/user/sessions');
        return response.data;
      } catch (error) {
        return { sessions: [] };
      }
    },
    retry: false,
  });

  // Деактивация сессии
  const deactivateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, permanent }: { sessionId: string; permanent?: boolean }) => {
      const url = `/telegram/user/sessions/${sessionId}${permanent ? '?permanent=true' : ''}`;
      return await apiClient.delete(url);
    },
    onSuccess: (_, variables) => {
      toast.success(variables.permanent ? 'Сессия полностью удалена' : 'Сессия деактивирована');
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

  // КРИТИЧНО: Gatekeeper - проверяем статус сессии перед показом интерфейса
  // ВСЕГДА после всех hooks, но перед финальным return
  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Проверка статуса Telegram сессии...</p>
      </div>
    );
  }

  // Если сессии нет или статус не active - показываем соответствующий UI
  if (!sessionStatus?.hasSession || (sessionStatus && sessionStatus.status !== 'active')) {
    if (sessionStatus?.status === 'initializing') {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Авторизация Telegram...</p>
        </div>
      );
    }
    if (sessionStatus?.status === 'expired' || sessionStatus?.status === 'error') {
      const statusMessage = sessionStatus && sessionStatus.status === 'expired' 
        ? 'Сессия истекла' 
        : 'Ошибка сессии';
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{statusMessage}</p>
        </div>
      );
    }
    // not_found или другой статус - показываем сообщение о необходимости авторизации
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <p className="text-muted-foreground">
          Для работы с личными сообщениями необходимо авторизоваться в Telegram.
        </p>
        <p className="text-sm text-muted-foreground">
          Перейдите на вкладку "Авторизация" и авторизуйтесь через телефон или QR-код.
        </p>
      </div>
    );
  }

  // ✅ Сессия активна - показываем основной интерфейс
  return (
    <div className="space-y-6">
      <Tabs 
        value={selectedTab} 
        onValueChange={(value) => setSelectedTab(value as 'send' | 'sessions')} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
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
          <Card>
            <CardHeader>
              <CardTitle>Выбор получателя</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChats || isLoadingContacts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>Загрузка чатов и контактов...</span>
                </div>
              ) : (chatsData?.chats?.length > 0 || contactsData?.contacts?.length > 0) ? (
                <Select value={selectedChatId} onValueChange={setSelectedChatId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите чат или контакт" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatsData?.chats?.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Чаты</div>
                        {chatsData.chats.map((chat: any) => (
                          <SelectItem key={chat.id} value={chat.id}>
                            {chat.title} ({chat.type})
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {contactsData?.contacts?.length > 0 && (
                      <>
                        {chatsData?.chats?.length > 0 && <div className="my-1 border-t" />}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Контакты</div>
                        {contactsData.contacts.map((contact: any) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.title} (контакт)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  {chatsError || contactsError ? (
                    <p className="text-sm text-destructive">
                      {(chatsError as any)?.response?.status === 401 || (contactsError as any)?.response?.status === 401
                        ? (chatsError as any)?.response?.data?.message?.includes('No active Telegram session') ||
                          (contactsError as any)?.response?.data?.message?.includes('No active Telegram session')
                          ? 'Нет активной Telegram сессии. Пожалуйста, авторизуйтесь через Telegram на вкладке "Авторизация".'
                          : 'Пожалуйста, войдите в Telegram. Перейдите на вкладку "Авторизация" и авторизуйтесь через телефон или QR-код.'
                        : 'Ошибка загрузки чатов и контактов. Попробуйте обновить страницу.'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Нет доступных чатов или контактов. Убедитесь, что вы авторизованы через Telegram.
                    </p>
                  )}
                </div>
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
                    <Card key={session.id} className={index === 0 ? 'border-primary border-2' : 'border'}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Статус сессии */}
                              <Badge
                                variant={
                                  session.status === 'active'
                                    ? 'default'
                                    : session.status === 'invalid'
                                    ? 'destructive'
                                    : session.status === 'revoked'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {session.status === 'active'
                                  ? 'Активна'
                                  : session.status === 'invalid'
                                  ? 'Невалидна'
                                  : session.status === 'revoked'
                                  ? 'Отозвана'
                                  : 'Инициализация'}
                              </Badge>
                              {session.isCurrent && (
                                <Badge variant="default">Текущая</Badge>
                              )}
                              {session.phoneNumber && (
                                <span className="text-sm font-medium">
                                  {session.phoneNumber}
                                </span>
                              )}
                              {session.userId && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  ID: {session.userId.substring(0, 8)}...
                                </span>
                              )}
                              {session.userEmail && (
                                <span className="text-xs text-muted-foreground">
                                  {session.userEmail}
                                </span>
                              )}
                            </div>
                            {session.invalidReason && (
                              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                <strong>Причина:</strong> {session.invalidReason}
                              </div>
                            )}
                            <div className="text-sm space-y-1.5">
                              {session.ipAddress && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground min-w-[100px]">IP адрес:</span>
                                  <span className="font-mono text-xs">{session.ipAddress}</span>
                                </div>
                              )}
                              {session.userAgent && (
                                <div className="flex items-start gap-2">
                                  <span className="text-muted-foreground min-w-[100px]">Устройство:</span>
                                  <span className="text-xs break-words">
                                    {session.userAgent.length > 80
                                      ? `${session.userAgent.substring(0, 80)}...`
                                      : session.userAgent}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground min-w-[100px]">Создана:</span>
                                <span>{formatDate(session.createdAt)}</span>
                              </div>
                              {session.lastUsedAt && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground min-w-[100px]">Использована:</span>
                                  <span>{formatDate(session.lastUsedAt)}</span>
                                </div>
                              )}
                              {session.dcId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground min-w-[100px]">DC ID:</span>
                                  <span>{session.dcId}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {/* Показываем кнопки в зависимости от статуса */}
                            {session.status === 'active' && !session.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deactivateSessionMutation.mutate({ sessionId: session.id, permanent: false })}
                                disabled={deactivateSessionMutation.isPending}
                              >
                                {deactivateSessionMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <X className="w-4 h-4 mr-2" />
                                    Деактивировать
                                  </>
                                )}
                              </Button>
                            )}
                            {(session.status === 'invalid' || session.status === 'revoked') && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Вы уверены, что хотите полностью удалить эту сессию? Это действие нельзя отменить.')) {
                                    deactivateSessionMutation.mutate({ sessionId: session.id, permanent: true });
                                  }
                                }}
                                disabled={deactivateSessionMutation.isPending}
                              >
                                {deactivateSessionMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Удалить
                                  </>
                                )}
                              </Button>
                            )}
                            {index === 0 && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Вы уверены, что хотите полностью удалить текущую сессию? Это действие нельзя отменить.')) {
                                    deactivateSessionMutation.mutate({ sessionId: session.id, permanent: true });
                                  }
                                }}
                                disabled={deactivateSessionMutation.isPending}
                              >
                                {deactivateSessionMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Удалить
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
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

