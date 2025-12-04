'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useEffect } from 'react';

interface MessageTypeSelectorProps {
  value: string;
  onChange: (value: any) => void;
  chatId: string;
}

interface ChatPermissions {
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
}

const messageTypes = [
  { value: 'text', label: 'Текст', requires: 'can_send_messages' },
  { value: 'photo', label: 'Фото', requires: 'can_send_media_messages' },
  { value: 'video', label: 'Видео', requires: 'can_send_media_messages' },
  { value: 'audio', label: 'Аудио', requires: 'can_send_media_messages' },
  { value: 'document', label: 'Документ', requires: 'can_send_media_messages' },
  { value: 'sticker', label: 'Стикер', requires: 'can_send_other_messages' },
  { value: 'location', label: 'Локация', requires: 'can_send_other_messages' },
  { value: 'poll', label: 'Опрос', requires: 'can_send_polls' },
];

export default function MessageTypeSelector({ value, onChange, chatId }: MessageTypeSelectorProps) {
  const [permissions, setPermissions] = useState<ChatPermissions | null>(null);

  const { data: chatInfo } = useQuery({
    queryKey: ['telegram-chat-permissions', chatId],
    queryFn: async () => {
      if (!chatId) return null;
      try {
        const { data } = await apiClient.get(`/telegram/chats/${chatId}`);
        return data.data;
      } catch (error) {
        return null;
      }
    },
    enabled: !!chatId,
  });

  useEffect(() => {
    if (chatInfo?.chatInfo?.permissions) {
      setPermissions(chatInfo.chatInfo.permissions);
    } else {
      // По умолчанию разрешаем все для личных чатов и если нет информации
      setPermissions({
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      });
    }
  }, [chatInfo]);

  const isAllowed = (type: string) => {
    if (!permissions || !chatId) return true; // По умолчанию разрешено
    
    const messageType = messageTypes.find((mt) => mt.value === type);
    if (!messageType) return true;
    
    const permissionKey = messageType.requires as keyof ChatPermissions;
    return permissions[permissionKey] !== false;
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        Тип сообщения
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
      >
        {messageTypes.map((type) => {
          const allowed = isAllowed(type.value);
          return (
            <option
              key={type.value}
              value={type.value}
              className={allowed ? 'text-green-600' : 'text-red-600'}
            >
              {type.label} {allowed ? '✓' : '✗'}
            </option>
          );
        })}
      </select>
      <div className="mt-2 flex flex-wrap gap-2">
        {messageTypes.map((type) => {
          const allowed = isAllowed(type.value);
          return (
            <span
              key={type.value}
              className={`px-2 py-1 rounded text-xs font-medium ${
                allowed
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {type.label}: {allowed ? 'Разрешено' : 'Запрещено'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

