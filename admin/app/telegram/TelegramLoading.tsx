'use client';

import { TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="space-y-4 py-10">
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Skeleton для заголовка */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          
          {/* Skeleton для формы */}
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          
          {/* Сообщение о статусе */}
          <div className="pt-2">
            <p className="text-muted-foreground text-sm">
              {getStatusMessage()}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Это обычно занимает несколько секунд
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

