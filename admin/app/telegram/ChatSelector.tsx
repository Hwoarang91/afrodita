'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TelegramChat {
  id: string;
  chatId: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

type ChatFilter = 'all' | 'private' | 'group' | 'channel';

export default function ChatSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [filter, setFilter] = useState<ChatFilter>('all');

  const { data: chats } = useQuery({
    queryKey: ['telegram-chats-for-selector'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats?active=true');
      return data.data as TelegramChat[];
    },
  });

  // Фильтрация чатов по выбранному типу
  const filteredChats = useMemo(() => {
    if (!chats) return [];

    switch (filter) {
      case 'private':
        return chats.filter((chat) => chat.type === 'private');
      case 'group':
        return chats.filter((chat) => chat.type === 'group' || chat.type === 'supergroup');
      case 'channel':
        return chats.filter((chat) => chat.type === 'channel');
      case 'all':
      default:
        return chats;
    }
  }, [chats, filter]);

  // Сброс выбранного чата при смене фильтра, если он не попадает в новый фильтр
  const selectedChat = chats?.find((chat) => chat.chatId === value);
  const isSelectedChatInFilter = selectedChat
    ? filter === 'all' ||
      (filter === 'private' && selectedChat.type === 'private') ||
      (filter === 'group' && (selectedChat.type === 'group' || selectedChat.type === 'supergroup')) ||
      (filter === 'channel' && selectedChat.type === 'channel')
    : true;

  // Если выбранный чат не попадает в новый фильтр - сбрасываем выбор
  if (!isSelectedChatInFilter && value) {
    onChange('');
  }

  return (
    <div className="space-y-3">
      <Label>Выберите группу или чат</Label>
      
      <Tabs value={filter} onValueChange={(val) => setFilter(val as ChatFilter)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="private">Личные</TabsTrigger>
          <TabsTrigger value="group">Группы</TabsTrigger>
          <TabsTrigger value="channel">Каналы</TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="-- Выберите чат --" />
        </SelectTrigger>
        <SelectContent>
          {filteredChats.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Нет доступных чатов этого типа
            </div>
          ) : (
            filteredChats.map((chat) => (
              <SelectItem key={chat.id} value={chat.chatId}>
                {chat.title || chat.username || `Chat ${chat.chatId}`}
                {chat.type !== filter && (
                  <span className="text-muted-foreground ml-1">
                    ({chat.type === 'supergroup' ? 'супергруппа' : chat.type})
                  </span>
                )}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        Выберите группу или чат из списка, в котором состоит бот
      </p>
    </div>
  );
}

