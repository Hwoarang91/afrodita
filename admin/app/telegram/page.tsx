'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import MessageTypeSelector from './MessageTypeSelector';
import FormattingHelp from './FormattingHelp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ChatInfo {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramChat {
  id: string;
  chatId: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  description?: string;
  photoUrl?: string;
  membersCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  chatInfo?: any;
}

export default function TelegramPage() {
  const [selectedTab, setSelectedTab] = useState<'send' | 'manage' | 'chats' | 'settings'>('chats');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'photo' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'poll'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');

  // Отправка сообщения
  const sendMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = `telegram/send-${mediaType === 'text' ? 'message' : mediaType}`;
      return await apiClient.post(`/${endpoint}`, data);
    },
    onSuccess: () => {
      toast.success('Сообщение отправлено');
      setMessage('');
      setMediaUrl('');
      setCaption('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отправке');
    },
  });

  const handleSend = () => {
    if (!chatId) {
      toast.error('Введите ID чата');
      return;
    }

    const data: any = { chatId };

    switch (mediaType) {
      case 'text':
        if (!message) {
          toast.error('Введите сообщение');
          return;
        }
        data.message = message;
        break;
      case 'photo':
      case 'video':
      case 'audio':
      case 'document':
        if (!mediaUrl) {
          toast.error('Введите URL или file_id медиа');
          return;
        }
        data[mediaType === 'photo' ? 'photo' : mediaType === 'document' ? 'document' : mediaType] = mediaUrl;
        if (caption) {
          data.caption = caption;
          data.parse_mode = 'HTML'; // Используем HTML для поддержки всех тегов в подписи
        }
        break;
      case 'sticker':
        if (!mediaUrl) {
          toast.error('Введите file_id стикера');
          return;
        }
        data.sticker = mediaUrl;
        break;
      case 'location':
        toast.error('Используйте вкладку "Управление" для отправки локации');
        return;
      case 'poll':
        if (!message) {
          toast.error('Введите вопрос опроса');
          return;
        }
        data.question = message;
        data.options = ['Вариант 1', 'Вариант 2', 'Вариант 3'];
        break;
    }

    sendMutation.mutate(data);
  };

  // Получение информации о чате
  const { data: chatInfo, refetch: refetchChat } = useQuery({
    queryKey: ['telegram-chat', chatId],
    queryFn: async () => {
      if (!chatId) return null;
      const { data } = await apiClient.get(`/telegram/get-chat/${chatId}`);
      return data.result;
    },
    enabled: false,
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Управление Telegram ботом</h1>

      {/* Вкладки */}
      <div className="mb-6 border-b border-border">
        <nav className="flex space-x-8">
          <button
            onClick={() => setSelectedTab('send')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'send'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Отправка сообщений
          </button>
          <button
            onClick={() => setSelectedTab('manage')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'manage'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Управление чатом
          </button>
          <button
            onClick={() => setSelectedTab('chats')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'chats'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Группы и чаты
          </button>
          <button
            onClick={() => setSelectedTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            Настройки
          </button>
        </nav>
      </div>

      {/* Вкладка: Отправка сообщений */}
      {selectedTab === 'send' && (
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Отправка сообщений</h2>

          <div className="space-y-4">
            <ChatSelector value={chatId} onChange={setChatId} />

            <MessageTypeSelector
              value={mediaType}
              onChange={setMediaType}
              chatId={chatId}
            />

            {mediaType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Сообщение
                </label>
                <FormattingHelp />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Введите текст сообщения..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
            )}

            {(mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio' || mediaType === 'document' || mediaType === 'sticker') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {mediaType === 'sticker' ? 'File ID стикера' : 'URL или File ID медиа'}
                  </label>
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg или file_id"
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  />
                </div>
                {mediaType !== 'sticker' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Подпись (опционально)
                    </label>
                    <FormattingHelp />
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      placeholder="Подпись к медиа..."
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                )}
              </>
            )}

            {mediaType === 'poll' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Вопрос опроса
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Введите вопрос..."
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Варианты ответов: Вариант 1, Вариант 2, Вариант 3 (по умолчанию)
                </p>
              </>
            )}

            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="w-full"
            >
              {sendMutation.isPending ? 'Отправка...' : 'Отправить'}
            </Button>
          </div>
        </div>
      )}

      {/* Вкладка: Управление чатом */}
      {selectedTab === 'manage' && (
        <ChatManagement />
      )}


      {/* Вкладка: Группы и чаты */}
      {selectedTab === 'chats' && (
        <ChatsList />
      )}

      {/* Вкладка: Настройки */}
      {selectedTab === 'settings' && (
        <div className="space-y-6">
          <WelcomeMessageSettings welcomeMessage={welcomeMessage} setWelcomeMessage={setWelcomeMessage} />
          <StartMessageSettings />
          <AutoRefreshSettings />
        </div>
      )}
    </div>
  );
}

function WelcomeMessageSettings({ welcomeMessage, setWelcomeMessage }: { welcomeMessage: string; setWelcomeMessage: (msg: string) => void }) {
  const queryClient = useQueryClient();
  
  // Загрузка текущего приветственного сообщения
  const { data: currentMessage, isLoading } = useQuery({
    queryKey: ['telegram-welcome-message'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/welcome-message');
      return data.message || '';
    },
  });

  // Обновление локального состояния при загрузке
  useEffect(() => {
    if (currentMessage !== undefined) {
      setWelcomeMessage(currentMessage);
    }
  }, [currentMessage, setWelcomeMessage]);

  // Сохранение приветственного сообщения
  const saveMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiClient.post('/telegram/welcome-message', { message });
    },
    onSuccess: async (data) => {
      toast.success('Приветственное сообщение сохранено');
      // Обновляем данные после сохранения
      await queryClient.invalidateQueries({ queryKey: ['telegram-welcome-message'] });
      // Обновляем локальное состояние сохраненным сообщением
      const { data: savedData } = await apiClient.get('/telegram/welcome-message');
      setWelcomeMessage(savedData.message || '');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при сохранении');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(welcomeMessage);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow p-6 border border-border">
      <h2 className="text-xl font-semibold text-foreground mb-4">Настройки приветственного сообщения</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Приветственное сообщение для новых участников группы
          </label>
          <FormattingHelp />
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={8}
            placeholder="Введите приветственное сообщение, которое будет отправляться каждому новому участнику группы..."
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Это сообщение будет отправляться каждому новому участнику группы индивидуально через личные сообщения.
            Поддерживается HTML и Markdown форматирование. Если оставить пустым, будет использовано сообщение по умолчанию.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function ChatsList() {
  const [selectedChat, setSelectedChat] = useState<TelegramChat | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: chats, isLoading, refetch } = useQuery({
    queryKey: ['telegram-chats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats?active=true');
      return data.data as TelegramChat[];
    },
  });
  
  const { data: chatDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['telegram-chat-details', selectedChat?.chatId],
    queryFn: async () => {
      if (!selectedChat) return null;
      const { data } = await apiClient.get(`/telegram/chats/${selectedChat.chatId}`);
      return data.data as TelegramChat;
    },
    enabled: !!selectedChat,
  });

  const { data: stats } = useQuery({
    queryKey: ['telegram-chats-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats/stats');
      return data.data;
    },
  });

  const getChatTypeLabel = (type: string) => {
    switch (type) {
      case 'group':
        return '👥 Группа';
      case 'supergroup':
        return '👥 Супергруппа';
      case 'channel':
        return '📢 Канал';
      case 'private':
        return '💬 Личный чат';
      default:
        return type;
    }
  };

  const getChatTypeColor = (type: string) => {
    switch (type) {
      case 'group':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'supergroup':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'channel':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'private':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
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
      {/* Статистика */}
      {stats && (
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">Статистика</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total || 0}</div>
              <div className="text-sm text-muted-foreground">Всего чатов</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active || 0}</div>
              <div className="text-sm text-muted-foreground">Активных</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.groups || 0}</div>
              <div className="text-sm text-muted-foreground">Групп</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.supergroups || 0}</div>
              <div className="text-sm text-muted-foreground">Супергрупп</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.channels || 0}</div>
              <div className="text-sm text-muted-foreground">Каналов</div>
            </div>
          </div>
        </div>
      )}

      {/* Список чатов */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-foreground">Группы и чаты</h2>
          <Button
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                const { data } = await apiClient.post('/telegram/chats/refresh');
                const result = data.data;
                const message = `Проверено: ${result.checked}, Обновлено: ${result.updated}, Добавлено: ${result.added || 0}, Удалено: ${result.removed}`;
                toast.success(message);
                await refetch();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Ошибка при проверке чатов');
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? '🔄 Обновление...' : '🔄 Обновить'}
          </Button>
        </div>

        {!chats || chats.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">Бот еще не добавлен ни в одну группу</p>
            <p className="text-sm">Добавьте бота в группу или канал, и он появится здесь автоматически</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {chat.photoUrl ? (
                    <img
                      src={chat.photoUrl}
                      alt={chat.title || 'Chat'}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-2xl">💬</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">
                        {chat.title || chat.username || `Chat ${chat.chatId}`}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getChatTypeColor(chat.type)}`}>
                        {getChatTypeLabel(chat.type)}
                      </span>
                      {chat.isActive ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Активен
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                          Неактивен
                        </span>
                      )}
                    </div>
                    {chat.username && (
                      <p className="text-sm text-muted-foreground mb-1">@{chat.username}</p>
                    )}
                    {chat.description && (
                      <p className="text-sm text-muted-foreground mb-2">{chat.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>ID: {chat.chatId}</span>
                      {chat.membersCount !== undefined && chat.membersCount > 0 && (
                        <span>Участников: {chat.membersCount}</span>
                      )}
                      <span>Добавлен: {new Date(chat.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChat(chat);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Подробнее
                    </Button>
                    <Button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await apiClient.delete(`/telegram/chats/${chat.chatId}`);
                          toast.success('Чат удален');
                          refetch();
                        } catch (error: any) {
                          toast.error(error.response?.data?.message || 'Ошибка при удалении чата');
                        }
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Модальное окно с информацией о чате */}
      {selectedChat && (
        <ChatInfoModal
          chat={chatDetails || selectedChat}
          isLoading={isLoadingDetails}
          onClose={() => setSelectedChat(null)}
          onDelete={() => {
            refetch();
            setSelectedChat(null);
          }}
        />
      )}
    </div>
  );
}

function ChatInfoModal({ chat, isLoading, onClose, onDelete }: { chat: TelegramChat; isLoading: boolean; onClose: () => void; onDelete?: () => void }) {
  const getChatTypeLabel = (type: string) => {
    switch (type) {
      case 'group':
        return '👥 Группа';
      case 'supergroup':
        return '👥 Супергруппа';
      case 'channel':
        return '📢 Канал';
      case 'private':
        return '💬 Личный чат';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 border border-border">
          <div className="animate-pulse">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-foreground">Информация о чате</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Фото и основная информация */}
          <div className="flex items-start gap-4">
            {chat.photoUrl ? (
              <img
                src={chat.photoUrl}
                alt={chat.title || 'Chat'}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-3xl">💬</span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {chat.title || chat.username || `Chat ${chat.chatId}`}
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {getChatTypeLabel(chat.type)}
                </span>
                {chat.isActive ? (
                  <span className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Активен
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded text-sm font-medium bg-muted text-muted-foreground">
                    Неактивен
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Детальная информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID чата</label>
              <p className="text-foreground font-mono">{chat.chatId}</p>
            </div>
            {chat.username && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <p className="text-foreground">@{chat.username}</p>
              </div>
            )}
            {chat.membersCount !== undefined && chat.membersCount > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Участников</label>
                <p className="text-foreground">{chat.membersCount}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Добавлен</label>
              <p className="text-foreground">
                {new Date(chat.createdAt).toLocaleString('ru-RU')}
              </p>
            </div>
            {chat.description && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Описание</label>
                <p className="text-foreground">{chat.description}</p>
              </div>
            )}
          </div>

          {/* Дополнительная информация из chatInfo */}
          {chat.chatInfo && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="font-semibold text-foreground mb-2">Дополнительная информация</h4>
              <div className="space-y-2 text-sm">
                {chat.chatInfo.invite_link && (
                  <div>
                    <span className="text-muted-foreground">Ссылка-приглашение: </span>
                    <a
                      href={chat.chatInfo.invite_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {chat.chatInfo.invite_link}
                    </a>
                  </div>
                )}
                {chat.chatInfo.linked_chat_id && (
                  <div>
                    <span className="text-muted-foreground">Связанный чат: </span>
                    <span className="text-foreground">{chat.chatInfo.linked_chat_id}</span>
                  </div>
                )}
                {chat.chatInfo.slow_mode_delay && (
                  <div>
                    <span className="text-muted-foreground">Задержка медленного режима: </span>
                    <span className="text-foreground">{chat.chatInfo.slow_mode_delay} сек</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Кнопка удаления */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button
              onClick={async () => {
                try {
                  await apiClient.delete(`/telegram/chats/${chat.chatId}`);
                  toast.success('Чат удален');
                  if (onDelete) {
                    onDelete();
                  }
                  onClose();
                } catch (error: any) {
                  toast.error(error.response?.data?.message || 'Ошибка при удалении чата');
                }
              }}
              variant="destructive"
              className="w-full"
            >
              Удалить чат из базы данных
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: chats } = useQuery({
    queryKey: ['telegram-chats-for-selector'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats?active=true');
      return data.data as TelegramChat[];
    },
  });

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Выберите группу или чат
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
      >
        <option value="">-- Выберите группу или чат --</option>
        {chats?.map((chat) => (
          <option key={chat.id} value={chat.chatId}>
            {chat.title || chat.username || `Chat ${chat.chatId}`} ({chat.type})
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground mt-1">
        Выберите группу или чат из списка, в котором состоит бот
      </p>
    </div>
  );
}

function ChatManagement() {
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [messageId, setMessageId] = useState('');
  const [permissions, setPermissions] = useState({
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
  });

  // Загрузка списка чатов
  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ['telegram-chats-for-management'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats?active=true');
      return data.data as TelegramChat[];
    },
  });

  // Загрузка информации о выбранном чате
  const { data: chatInfo, refetch: refetchChatInfo } = useQuery({
    queryKey: ['telegram-chat-info', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return null;
      const { data } = await apiClient.get(`/telegram/chats/${selectedChatId}`);
      return data.data as TelegramChat;
    },
    enabled: !!selectedChatId,
  });

  // Обновление полей при загрузке информации о чате
  useEffect(() => {
    if (chatInfo) {
      setTitle(chatInfo.title || '');
      setDescription(chatInfo.description || '');
      setPhotoUrl(chatInfo.photoUrl || '');
    }
  }, [chatInfo]);

  // Мутации для управления чатом
  const setTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiClient.post(`/telegram/chats/${selectedChatId}/title`, { title });
    },
    onSuccess: () => {
      toast.success('Название чата обновлено');
      refetchChatInfo();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении названия');
    },
  });

  const setDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      return await apiClient.post(`/telegram/chats/${selectedChatId}/description`, { description });
    },
    onSuccess: () => {
      toast.success('Описание чата обновлено');
      refetchChatInfo();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении описания');
    },
  });

  const setPhotoMutation = useMutation({
    mutationFn: async (photo: string) => {
      return await apiClient.post(`/telegram/chats/${selectedChatId}/photo`, { photo });
    },
    onSuccess: () => {
      toast.success('Фото чата обновлено');
      refetchChatInfo();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении фото');
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.delete(`/telegram/chats/${selectedChatId}/photo`);
    },
    onSuccess: () => {
      toast.success('Фото чата удалено');
      refetchChatInfo();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при удалении фото');
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async (data: { messageId: number; disable_notification?: boolean }) => {
      return await apiClient.post(`/telegram/chats/${selectedChatId}/pin`, data);
    },
    onSuccess: () => {
      toast.success('Сообщение закреплено');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при закреплении сообщения');
    },
  });

  const unpinMessageMutation = useMutation({
    mutationFn: async (messageId?: number) => {
      const url = messageId 
        ? `/telegram/chats/${selectedChatId}/pin?messageId=${messageId}`
        : `/telegram/chats/${selectedChatId}/pin`;
      return await apiClient.delete(url);
    },
    onSuccess: () => {
      toast.success('Сообщение откреплено');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при откреплении сообщения');
    },
  });

  const unpinAllMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.delete(`/telegram/chats/${selectedChatId}/pin/all`);
    },
    onSuccess: () => {
      toast.success('Все сообщения откреплены');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при откреплении сообщений');
    },
  });

  const setPermissionsMutation = useMutation({
    mutationFn: async (perms: any) => {
      return await apiClient.post(`/telegram/chats/${selectedChatId}/permissions`, perms);
    },
    onSuccess: () => {
      toast.success('Разрешения чата обновлены');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении разрешений');
    },
  });

  const handleSetTitle = () => {
    if (!selectedChatId) {
      toast.error('Выберите чат');
      return;
    }
    if (!title.trim()) {
      toast.error('Введите название чата');
      return;
    }
    setTitleMutation.mutate(title);
  };

  const handleSetDescription = () => {
    if (!selectedChatId) {
      toast.error('Выберите чат');
      return;
    }
    setDescriptionMutation.mutate(description);
  };

  const handleSetPhoto = () => {
    if (!selectedChatId) {
      toast.error('Выберите чат');
      return;
    }
    if (!photoUrl.trim()) {
      toast.error('Введите URL или file_id фото');
      return;
    }
    setPhotoMutation.mutate(photoUrl);
  };

  const handlePinMessage = () => {
    if (!selectedChatId) {
      toast.error('Выберите чат');
      return;
    }
    const msgId = parseInt(messageId, 10);
    if (isNaN(msgId)) {
      toast.error('Введите корректный ID сообщения');
      return;
    }
    pinMessageMutation.mutate({ messageId: msgId });
  };

  const handleSetPermissions = () => {
    if (!selectedChatId) {
      toast.error('Выберите чат');
      return;
    }
    setPermissionsMutation.mutate(permissions);
  };

  return (
    <div className="space-y-6">
      {/* Выбор чата */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">Управление чатом</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Выберите группу или чат
          </label>
          <select
            value={selectedChatId}
            onChange={(e) => setSelectedChatId(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            disabled={isLoadingChats}
          >
            <option value="">-- Выберите группу или чат --</option>
            {chats?.map((chat) => (
              <option key={chat.id} value={chat.chatId}>
                {chat.title || chat.username || `Chat ${chat.chatId}`} ({chat.type})
              </option>
            ))}
          </select>
        </div>

        {selectedChatId && chatInfo && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-foreground mb-2">Информация о чате</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>ID:</strong> {chatInfo.chatId}</p>
              <p><strong>Тип:</strong> {chatInfo.type}</p>
              {chatInfo.membersCount !== undefined && (
                <p><strong>Участников:</strong> {chatInfo.membersCount}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedChatId && (
        <>
          {/* Название чата */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Название чата</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Новое название
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите название чата..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <button
                onClick={handleSetTitle}
                disabled={setTitleMutation.isPending}
              >
                {setTitleMutation.isPending ? 'Обновление...' : 'Обновить название'}
              </button>
            </div>
          </div>

          {/* Описание чата */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Описание чата</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Новое описание
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Введите описание чата..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <button
                onClick={handleSetDescription}
                disabled={setDescriptionMutation.isPending}
              >
                {setDescriptionMutation.isPending ? 'Обновление...' : 'Обновить описание'}
              </button>
            </div>
          </div>

          {/* Фото чата */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Фото чата</h3>
            <div className="space-y-4">
              {chatInfo?.photoUrl && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Текущее фото
                  </label>
                  <img
                    src={chatInfo.photoUrl}
                    alt="Chat photo"
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  URL или file_id нового фото
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Введите URL или file_id..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetPhoto}
                  disabled={setPhotoMutation.isPending}
                >
                  {setPhotoMutation.isPending ? 'Обновление...' : 'Обновить фото'}
                </button>
                {chatInfo?.photoUrl && (
                  <button
                    onClick={() => deletePhotoMutation.mutate()}
                    disabled={deletePhotoMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletePhotoMutation.isPending ? 'Удаление...' : 'Удалить фото'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Закрепление сообщений */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Закрепление сообщений</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  ID сообщения для закрепления
                </label>
                <input
                  type="number"
                  value={messageId}
                  onChange={(e) => setMessageId(e.target.value)}
                  placeholder="Введите ID сообщения..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handlePinMessage}
                  disabled={pinMessageMutation.isPending}
                >
                  {pinMessageMutation.isPending ? 'Закрепление...' : 'Закрепить сообщение'}
                </button>
                <button
                  onClick={() => unpinMessageMutation.mutate(messageId ? parseInt(messageId, 10) : undefined)}
                  disabled={unpinMessageMutation.isPending}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unpinMessageMutation.isPending ? 'Открепление...' : 'Открепить сообщение'}
                </button>
                <button
                  onClick={() => unpinAllMutation.mutate()}
                  disabled={unpinAllMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unpinAllMutation.isPending ? 'Открепление...' : 'Открепить все сообщения'}
                </button>
              </div>
            </div>
          </div>

          {/* Разрешения чата */}
          <div className="bg-card rounded-lg shadow p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Разрешения чата</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                {Object.entries(permissions).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-foreground">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSetPermissions}
                disabled={setPermissionsMutation.isPending}
              >
                {setPermissionsMutation.isPending ? 'Обновление...' : 'Обновить разрешения'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StartMessageSettings() {
  const queryClient = useQueryClient();
  const [startMessage, setStartMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка текущего сообщения /start
  const { data: currentStartMessage, isLoading: isLoadingStartMessage } = useQuery({
    queryKey: ['telegram-start-message'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/telegram/start-message');
        return data.message || '';
      } catch (error: any) {
        if (error.response?.status === 404) {
          return '';
        }
        throw error;
      }
    },
  });

  useEffect(() => {
    if (currentStartMessage !== undefined) {
      setStartMessage(currentStartMessage || '');
      setIsLoading(false);
    }
  }, [currentStartMessage]);

  const saveMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiClient.post('/telegram/start-message', { message });
    },
    onSuccess: () => {
      toast.success('Сообщение /start сохранено');
      queryClient.invalidateQueries({ queryKey: ['telegram-start-message'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при сохранении сообщения');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(startMessage);
  };

  if (isLoading || isLoadingStartMessage) {
    return (
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Сообщение для команды /start
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Это сообщение будет отправляться при команде /start. Оставьте пустым для использования сообщения по умолчанию.
      </p>
      <FormattingHelp />
      <textarea
        value={startMessage}
        onChange={(e) => setStartMessage(e.target.value)}
        rows={6}
        placeholder="Введите сообщение для /start..."
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground mb-4"
      />
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  );
}

function AutoRefreshSettings() {
  const queryClient = useQueryClient();
  const [refreshInterval, setRefreshInterval] = useState<number>(60); // в минутах
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка текущего интервала
  useQuery({
    queryKey: ['telegram-auto-refresh-interval'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/settings/telegram-auto-refresh-interval');
        return data.value || 60;
      } catch {
        return 60; // Значение по умолчанию
      }
    },
    onSuccess: (data) => {
      setRefreshInterval(data);
      setIsLoading(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (interval: number) => {
      return await apiClient.put('/settings/telegram-auto-refresh-interval', { value: interval });
    },
    onSuccess: () => {
      toast.success('Интервал автоматического обновления сохранен');
      queryClient.invalidateQueries({ queryKey: ['telegram-auto-refresh-interval'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при сохранении интервала');
    },
  });

  const handleSave = () => {
    if (refreshInterval < 1) {
      toast.error('Интервал должен быть не менее 1 минуты');
      return;
    }
    saveMutation.mutate(refreshInterval);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Автоматическое обновление чатов
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Установите интервал (в минутах) для автоматической проверки актуальности чатов и групп.
      </p>
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium text-foreground">
          Интервал (минуты):
        </label>
        <input
          type="number"
          min="1"
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10) || 60)}
          className="w-32 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  );
}

