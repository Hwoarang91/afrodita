'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Send, MessageSquare, Image, Video, File, Loader2 } from 'lucide-react';

export default function TelegramUserPage() {
  const [selectedChatId, setSelectedChatId] = useState('');
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'photo' | 'video' | 'document'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');

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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Отправка сообщений от вашего имени</h1>

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
    </div>
  );
}

