'use client';

import { TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';
import { cn } from '@/lib/utils';

interface TelegramHeaderProps {
  status: TelegramSessionStatus;
}

const statusMap: Record<TelegramSessionStatus, { label: string; className: string }> = {
  none: { label: 'Не подключен', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  initializing: { label: 'Подключение...', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  waiting_2fa: { label: 'Ожидание 2FA', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  active: { label: 'Подключен', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  expired: { label: 'Сессия истекла', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  error: { label: 'Ошибка', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

export function TelegramHeader({ status }: TelegramHeaderProps) {
  const statusInfo = statusMap[status];

  return (
    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
      <h2 className="text-lg font-semibold text-foreground">Telegram</h2>
      <span className={cn('px-3 py-1 rounded text-sm font-medium', statusInfo.className)}>
        {statusInfo.label}
      </span>
    </div>
  );
}

