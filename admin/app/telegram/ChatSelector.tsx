'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Label } from '@/components/ui/label';

interface TelegramChat {
  id: string;
  chatId: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

export default function ChatSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: chats } = useQuery({
    queryKey: ['telegram-chats-for-selector'],
    queryFn: async () => {
      const { data } = await apiClient.get('/telegram/chats?active=true');
      return data.data as TelegramChat[];
    },
  });

  return (
    <div>
      <Label htmlFor="chat-selector">Выберите группу или чат</Label>
      <select
        id="chat-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
      >
        <option value="">-- Выберите чат --</option>
        {chats?.map((chat) => (
          <option key={chat.id} value={chat.chatId}>
            {chat.title || chat.username || `Chat ${chat.chatId}`} ({chat.type})
          </option>
        ))}
      </select>
    </div>
  );
}

