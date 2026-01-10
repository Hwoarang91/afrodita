'use client';

import { Loader2 } from 'lucide-react';
import { TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';

interface TelegramLoadingProps {
  status: TelegramSessionStatus;
  message?: string;
}

export function TelegramLoading({ status, message }: TelegramLoadingProps) {
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'initializing':
        return 'Авторизация Telegram...';
      case 'waiting_2fa':
        return 'Ожидание ввода пароля 2FA...';
      default:
        return 'Загрузка...';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-muted-foreground text-lg">
        {getStatusMessage()}
      </p>
      <p className="text-muted-foreground text-sm">
        Это обычно занимает несколько секунд
      </p>
    </div>
  );
}

