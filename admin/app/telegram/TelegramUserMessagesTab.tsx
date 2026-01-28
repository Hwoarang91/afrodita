'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTelegramSession, TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';
import { useTelegramWebSocket } from '@/lib/hooks/useTelegramWebSocket';
import { TelegramLoading } from './TelegramLoading';
import { ErrorCard } from './components/ErrorCard';
import { FloodWaitTimer, FloodWaitEvent } from './components/FloodWaitTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Send, MessageSquare, Image, Video, File, Loader2, Shield, Trash2, X, Pin, History, Check, CheckCheck, Circle, Wifi, WifiOff, Clock } from 'lucide-react';
import { MediaPreview, MediaData } from './components/MediaPreview';
import { MessageDeliveryStatus } from './components/MessageDeliveryStatus';
import { MessageActions } from './components/MessageActions';
import { ConnectionStatusIndicator, ConnectionStatusData } from './components/ConnectionStatusIndicator';
import { EventLogViewer } from './components/EventLogViewer';
import { TelegramEventLog } from '@/lib/hooks/useTelegramWebSocket';

interface Message {
  id: number;
  fromId: string | null;
  message: string;
  date: number;
  out: boolean;
  media?: MediaData | null;
  readOutbox?: boolean | null;
  readInbox?: boolean | null;
  reactions?: {
    results: Array<{
      reaction: string;
      count: number;
    }>;
    recentReactions?: Array<{
      reaction: string;
      peerId: string | null;
    }>;
  } | null;
  editDate?: number | null;
  replyTo?: {
    replyToMsgId: number;
    replyToPeerId: string | null;
  } | null;
  forwards?: number | null;
  views?: number | null;
  pinned?: boolean;
}

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

interface TelegramUserMessagesTabProps {
  /** Вызывается при нажатии «Перейти к авторизации», когда сессии нет (переключение на вкладку Авторизация). */
  onRequestAuth?: () => void;
}

export default function TelegramUserMessagesTab(props?: TelegramUserMessagesTabProps) {
  const { onRequestAuth } = props ?? {};
  const [selectedTab, setSelectedTab] = useState<'send' | 'sessions' | 'events'>('send');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'photo' | 'video' | 'document'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [floodWaitEvent, setFloodWaitEvent] = useState<FloodWaitEvent | null>(null);
  const [eventLogs, setEventLogs] = useState<TelegramEventLog[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<number | null>(null);
  const [forwardSourceChatId, setForwardSourceChatId] = useState<string>('');
  const [forwardToChatId, setForwardToChatId] = useState<string>('');
  const queryClient = useQueryClient();

  // КРИТИЧНО: Проверяем статус Telegram сессии перед загрузкой данных
  const { data: sessionData, status, isLoading: isLoadingSession } = useTelegramSession();
  const sessionStatus = status as TelegramSessionStatus;
  
  // Получаем sessionId из активной сессии
  const currentSessionId = sessionData?.sessionId;

  // Состояние статуса соединения
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusData | null>(null);

  // Получение статуса соединения
  const { data: connectionStatusData } = useQuery({
    queryKey: ['telegram-connection-status', currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return null;
      const response = await apiClient.get('/telegram/user/connection-status');
      return response.data;
    },
    enabled: sessionStatus === 'active' && !!currentSessionId,
    refetchInterval: 10000, // Обновляем каждые 10 секунд
  });

  // Обновляем состояние статуса соединения
  useEffect(() => {
    if (connectionStatusData) {
      setConnectionStatus({
        isConnected: connectionStatusData.isConnected || false,
        connectionState: connectionStatusData.connectionState || 'unknown',
        lastActivity: connectionStatusData.lastActivity || null,
        lastHeartbeatCheck: connectionStatusData.lastHeartbeatCheck || null,
        lastHeartbeatStatus: connectionStatusData.lastHeartbeatStatus ?? null,
        consecutiveHeartbeatFailures: connectionStatusData.consecutiveHeartbeatFailures || 0,
        lastError: connectionStatusData.lastError,
        lastInvokeMethod: connectionStatusData.lastInvokeMethod,
        lastInvokeDuration: connectionStatusData.lastInvokeDuration,
      });
    }
  }, [connectionStatusData]);

  // WebSocket подключение для получения FloodWait событий и обновления статусов
  useTelegramWebSocket({
    enabled: sessionStatus === 'active' && !!currentSessionId,
    sessionId: currentSessionId || undefined,
    eventTypes: ['flood-wait', 'invoke', 'connect', 'disconnect'],
    onEventLog: (event) => {
      if (event.type === 'flood-wait') {
        setFloodWaitEvent({
          sessionId: event.sessionId,
          userId: event.userId,
          waitTime: event.data.waitTime || 0,
          method: event.data.method,
          timestamp: event.timestamp,
        });
      }
      // Обновляем список чатов при успешных invoke операциях (могут изменить статусы сообщений)
      if (event.type === 'invoke' && event.data?.method?.includes('messages')) {
        // Небольшая задержка перед обновлением, чтобы дать Telegram время обновить статусы
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['telegram-user-chats'] });
        }, 1000);
      }
      // Обновляем статус соединения при connect/disconnect
      if (event.type === 'connect' || event.type === 'disconnect') {
        queryClient.invalidateQueries({ queryKey: ['telegram-connection-status', currentSessionId] });
      }
      
      // Добавляем событие в лог
      setEventLogs((prev) => {
        const newLogs = [...prev, event];
        // Ограничиваем размер лога до 1000 событий
        return newLogs.slice(-1000);
      });
    },
    onConnectionStatus: (status) => {
      setConnectionStatus({
        isConnected: status.isConnected || false,
        connectionState: (status.status === 'heartbeat' ? 'connected' : status.status === 'connected' ? 'connected' : status.status === 'disconnected' ? 'disconnected' : status.status === 'error' ? 'error' : 'unknown') as 'connected' | 'disconnected' | 'unknown' | 'error',
        lastActivity: status.timestamp || null,
      });
    },
  });
  
  // Периодическое обновление статусов чатов (каждые 30 секунд)
  useEffect(() => {
    if (sessionStatus !== 'active') return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['telegram-user-chats'] });
    }, 30000); // 30 секунд
    
    return () => clearInterval(interval);
  }, [sessionStatus, queryClient]);
  
  // Определяем, можем ли мы загружать Telegram данные
  const canLoadTelegramData = sessionStatus === 'active';

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

  // Получение истории сообщений - ТОЛЬКО если сессия active и выбран чат
  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery({
    queryKey: ['telegram-user-messages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return null;
      const response = await apiClient.get(`/telegram/user/messages/${selectedChatId}?limit=50`);
      return response.data;
    },
    enabled: canLoadTelegramData && !!selectedChatId, // КРИТИЧНО: Загружаем только когда сессия active и выбран чат
    retry: false,
  });

  // Отправка текстового сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { chatId: string; message: string; parseMode?: string }) => {
      return await apiClient.post('/telegram/user/send-message', data);
    },
    onSuccess: (_, variables) => {
      toast.success('Сообщение отправлено');
      setMessage('');
      // Обновляем историю сообщений после отправки
      queryClient.invalidateQueries({ queryKey: ['telegram-user-messages', variables.chatId] });
      // Обновляем список чатов для обновления статуса последнего сообщения
      queryClient.invalidateQueries({ queryKey: ['telegram-user-chats'] });
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
    onSuccess: (_, variables) => {
      toast.success('Медиа отправлено');
      setMediaUrl('');
      setCaption('');
      // Обновляем историю сообщений после отправки
      queryClient.invalidateQueries({ queryKey: ['telegram-user-messages', variables.chatId] });
      // Обновляем список чатов для обновления статуса последнего сообщения
      queryClient.invalidateQueries({ queryKey: ['telegram-user-chats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отправке медиа');
    },
  });

  // Пересылка сообщения
  const forwardMutation = useMutation({
    mutationFn: async ({
      sourceChatId,
      messageId,
      toChatId,
    }: {
      sourceChatId: string;
      messageId: number;
      toChatId: string;
    }) => {
      return await apiClient.post(
        `/telegram/user/messages/${sourceChatId}/${messageId}/forward`,
        { toChatId },
      );
    },
    onSuccess: (_, variables) => {
      setForwardDialogOpen(false);
      setForwardMessageId(null);
      setForwardSourceChatId('');
      setForwardToChatId('');
      toast.success('Сообщение переслано');
      queryClient.invalidateQueries({ queryKey: ['telegram-user-messages', variables.sourceChatId] });
      queryClient.invalidateQueries({ queryKey: ['telegram-user-messages', variables.toChatId] });
      queryClient.invalidateQueries({ queryKey: ['telegram-user-chats'] });
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Ошибка при пересылке сообщения';
      toast.error(msg);
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

  const formatMessageDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('ru-RU', {
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
      <div className="space-y-4 py-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-64" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="pt-2">
              <p className="text-muted-foreground text-sm">Проверка статуса Telegram сессии...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Если сессии нет или статус не active - показываем соответствующий UI
  if (sessionStatus !== 'active') {
    if (sessionStatus === 'initializing' || sessionStatus === 'waiting_2fa') {
      return (
        <TelegramLoading status={sessionStatus} />
      );
    }
    if (sessionStatus === 'expired' || sessionStatus === 'error') {
      return (
        <ErrorCard
          title={sessionStatus === 'expired' ? 'Telegram сессия истекла' : 'Ошибка Telegram сессии'}
          message={sessionData?.invalidReason || (sessionStatus === 'expired' ? 'Сессия была отозвана или истекла' : 'Не удалось подключить Telegram аккаунт')}
          actionText="Переавторизоваться"
          onAction={() => {
            if (onRequestAuth) {
              onRequestAuth();
            } else {
              window.location.href = '/telegram-user';
            }
          }}
        />
      );
    }
    // none или другой статус - показываем сообщение о необходимости авторизации
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <p className="text-muted-foreground text-lg">
          Для работы с личными сообщениями необходимо авторизоваться в Telegram.
        </p>
        <p className="text-sm text-muted-foreground">
          Перейдите на вкладку &quot;Авторизация&quot; и авторизуйтесь через телефон или QR-код.
        </p>
        {onRequestAuth && (
          <Button onClick={onRequestAuth}>
            Перейти к авторизации
          </Button>
        )}
      </div>
    );
  }

  // Сессия активна - показываем основной интерфейс
  return (
    <div className="space-y-6">
      {/* Таймер FloodWait */}
      {floodWaitEvent && (
        <FloodWaitTimer
          event={floodWaitEvent}
          onDismiss={() => setFloodWaitEvent(null)}
        />
      )}
      
      <Tabs 
        value={selectedTab} 
        onValueChange={(value) => setSelectedTab(value as 'send' | 'sessions' | 'events')} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">
            <Send className="w-4 h-4 mr-2" />
            Отправка сообщений
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Shield className="w-4 h-4 mr-2" />
            Управление сессиями
          </TabsTrigger>
          <TabsTrigger value="events">
            <History className="w-4 h-4 mr-2" />
            Event Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Выбор получателя</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChats || isLoadingContacts ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-10 w-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                  </div>
                </div>
              ) : (chatsData?.chats?.length > 0 || contactsData?.contacts?.length > 0) ? (
                <TooltipProvider>
                  <Select value={selectedChatId} onValueChange={setSelectedChatId}>
                    <SelectTrigger>
                      <div className="flex items-center gap-2 w-full">
                        <SelectValue placeholder="Выберите чат или контакт" />
                        {connectionStatus && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="ml-auto">
                                {connectionStatus.isConnected ? (
                                  <Wifi className="w-4 h-4 text-green-500" />
                                ) : (
                                  <WifiOff className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Статус соединения: {connectionStatus.isConnected ? 'Активно' : 'Неактивно'}</p>
                              {connectionStatus.lastActivity && (
                                <p className="text-xs mt-1">
                                  Последняя активность: {new Date(connectionStatus.lastActivity).toLocaleString('ru-RU')}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                    {chatsData?.chats?.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Чаты</div>
                        {[...(chatsData.chats || [])]
                          .sort((a: any, b: any) => {
                            // Сортировка: закрепленные сверху, затем по непрочитанным
                            const aPinned = a.pinned ? 1 : 0;
                            const bPinned = b.pinned ? 1 : 0;
                            if (aPinned !== bPinned) {
                              return bPinned - aPinned;
                            }
                            const aUnread = a.unreadCount || 0;
                            const bUnread = b.unreadCount || 0;
                            return bUnread - aUnread;
                          })
                          .map((chat: any) => {
                            // Форматирование времени последнего сообщения
                            const formatLastMessageTime = (timestamp: number) => {
                              if (!timestamp) return '';
                              const date = new Date(timestamp * 1000);
                              const now = new Date();
                              const diff = now.getTime() - date.getTime();
                              const minutes = Math.floor(diff / 60000);
                              const hours = Math.floor(diff / 3600000);
                              const days = Math.floor(diff / 86400000);
                              
                              if (minutes < 1) return 'только что';
                              if (minutes < 60) return `${minutes} мин назад`;
                              if (hours < 24) return `${hours} ч назад`;
                              if (days < 7) return `${days} дн назад`;
                              return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                            };
                            
                            // Индикатор статуса последнего отправленного сообщения
                            let StatusIcon: React.ReactNode = null;
                            if (chat.lastMessage?.out && chat.lastMessage?.status) {
                              switch (chat.lastMessage.status) {
                                case 'read':
                                  StatusIcon = (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <CheckCheck 
                                          className="w-3.5 h-3.5 text-primary ml-2" 
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Прочитано</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                  break;
                                case 'delivered':
                                  StatusIcon = (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <CheckCheck 
                                          className="w-3.5 h-3.5 text-muted-foreground ml-2" 
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Доставлено</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                  break;
                                case 'sent':
                                  StatusIcon = (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Check 
                                          className="w-3.5 h-3.5 text-muted-foreground ml-2" 
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Отправлено</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                  break;
                              }
                            }
                            
                            // Индикатор статуса соединения
                            const ConnectionIcon = connectionStatus?.isConnected ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Wifi className="w-3 h-3 text-green-500 ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Соединение активно</p>
                                  {connectionStatus.lastActivity && (
                                    <p className="text-xs mt-1">
                                      Активность: {formatLastMessageTime(Math.floor(new Date(connectionStatus.lastActivity).getTime() / 1000))}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <WifiOff className="w-3 h-3 text-red-500 ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Соединение неактивно</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                            
                            // Информация для tooltip
                            const tooltipInfo = [
                              chat.pinned && 'Закреплен',
                              chat.unreadCount > 0 && `Непрочитанных: ${chat.unreadCount}`,
                              chat.lastMessage && `Последнее сообщение: ${formatLastMessageTime(chat.lastMessage.date)}`,
                              chat.type && `Тип: ${chat.type}`,
                            ].filter(Boolean).join('\n');
                            
                            return (
                              <SelectItem key={chat.id} value={chat.id} className={chat.pinned ? 'bg-muted/50' : ''}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {chat.pinned && (
                                      <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="truncate flex-1">
                                          {chat.title} ({chat.type})
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-semibold">{chat.title}</p>
                                          {tooltipInfo && (
                                            <div className="text-xs text-muted-foreground whitespace-pre-line">
                                              {tooltipInfo}
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                    {chat.unreadCount > 0 && (
                                      <Badge variant="default" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    {StatusIcon}
                                    {connectionStatus && ConnectionIcon}
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
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
                </TooltipProvider>
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

          {/* История сообщений */}
          {selectedChatId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  История сообщений
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingMessages ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-destructive">
                      Ошибка загрузки истории сообщений
                    </p>
                  </div>
                ) : messagesData?.messages && messagesData.messages.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {messagesData.messages.map((msg: Message) => (
                      <div
                        key={msg.id}
                        className={`group p-4 rounded-lg border ${
                          msg.out
                            ? 'bg-primary/5 border-primary/20 ml-8'
                            : 'bg-muted/50 border-border mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {msg.out ? 'Вы' : `ID: ${msg.fromId || 'Неизвестно'}`}
                            </span>
                            {msg.out && (
                              <Badge variant="outline" className="text-xs">
                                Исходящее
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatMessageDate(msg.date)}
                            </span>
                            {/* Статус доставки */}
                            <MessageDeliveryStatus
                              out={msg.out}
                              readOutbox={msg.readOutbox}
                              readInbox={msg.readInbox}
                            />
                            {/* Быстрые действия - показываем при hover */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MessageActions
                                messageId={msg.id}
                                chatId={selectedChatId}
                                onForward={(messageId, chatId) => {
                                  setForwardMessageId(messageId);
                                  setForwardSourceChatId(chatId);
                                  setForwardToChatId('');
                                  setForwardDialogOpen(true);
                                }}
                                onDelete={async (messageId, chatId) => {
                                  try {
                                    await apiClient.delete(`/telegram/user/messages/${chatId}/${messageId}`);
                                    toast.success('Сообщение удалено');
                                    queryClient.invalidateQueries({ queryKey: ['telegram-user-messages', chatId] });
                                  } catch (error: any) {
                                    toast.error(`Ошибка удаления сообщения: ${error.message}`);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        {msg.message && (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        )}
                        {msg.media && (
                          <div className="mt-3">
                            <MediaPreview media={msg.media} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      История сообщений пуста
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
                <div className="space-y-4 py-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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

        {/* Таб: Event Log */}
        <TabsContent value="events" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">MTProto Event Log</h3>
              <p className="text-sm text-muted-foreground">
                Просмотр событий MTProto в реальном времени
              </p>
            </div>
            <ConnectionStatusIndicator status={connectionStatus} showDetails />
          </div>
          <EventLogViewer
            events={eventLogs}
            onClear={() => setEventLogs([])}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={forwardDialogOpen}
        onOpenChange={(open) => {
          setForwardDialogOpen(open);
          if (!open) {
            setForwardMessageId(null);
            setForwardSourceChatId('');
            setForwardToChatId('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Переслать сообщение</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isLoadingChats || isLoadingContacts ? (
              <Skeleton className="h-10 w-full" />
            ) : (() => {
              const chats = (chatsData?.chats || []).filter((c: { id: string }) => c.id !== forwardSourceChatId);
              const contacts = (contactsData?.contacts || []).filter((c: { id: string }) => c.id !== forwardSourceChatId);
              const hasItems = chats.length > 0 || contacts.length > 0;
              return hasItems ? (
                <Select value={forwardToChatId} onValueChange={setForwardToChatId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите чат или контакт" />
                  </SelectTrigger>
                  <SelectContent>
                    {chats.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Чаты</div>
                        {chats.map((chat: { id: string; title?: string; type?: string }) => (
                          <SelectItem key={chat.id} value={chat.id}>
                            {chat.title || chat.id} ({chat.type || 'чат'})
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {contacts.length > 0 && (
                      <>
                        {chats.length > 0 && <div className="my-1 border-t" />}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Контакты</div>
                        {contacts.map((contact: { id: string; title?: string }) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.title || contact.id} (контакт)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">Нет других чатов или контактов.</p>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={
                !forwardToChatId ||
                forwardMutation.isPending ||
                forwardMessageId == null ||
                !forwardSourceChatId
              }
              onClick={() =>
                forwardMutation.mutate({
                  sourceChatId: forwardSourceChatId,
                  messageId: forwardMessageId!,
                  toChatId: forwardToChatId,
                })
              }
            >
              {forwardMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Переслать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

