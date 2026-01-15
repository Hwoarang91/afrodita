'use client';

import { Wifi, WifiOff, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ConnectionStatusData {
  isConnected: boolean;
  connectionState: 'connected' | 'disconnected' | 'unknown' | 'error';
  lastActivity: string | null;
  lastHeartbeatCheck?: string | null;
  lastHeartbeatStatus?: boolean | null;
  consecutiveHeartbeatFailures?: number;
  lastError?: string;
  lastInvokeMethod?: string;
  lastInvokeDuration?: number;
}

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatusData | null;
  className?: string;
  showDetails?: boolean;
}

/**
 * Компонент для отображения статуса соединения Telegram аккаунта
 */
export function ConnectionStatusIndicator({
  status,
  className,
  showDetails = false,
}: ConnectionStatusIndicatorProps) {
  if (!status) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-2', className)}>
              <Circle className="w-3 h-3 text-muted-foreground animate-pulse" />
              <span className="text-xs text-muted-foreground">Статус неизвестен</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Статус соединения не загружен</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = () => {
    switch (status.connectionState) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-red-500';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusBadge = () => {
    switch (status.connectionState) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Подключено</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Отключено</Badge>;
      case 'error':
        return <Badge variant="destructive">Ошибка</Badge>;
      default:
        return <Badge variant="outline">Неизвестно</Badge>;
    }
  };

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">
        Статус: {status.connectionState === 'connected' ? 'Подключено' : status.connectionState === 'disconnected' ? 'Отключено' : status.connectionState === 'error' ? 'Ошибка' : 'Неизвестно'}
      </p>
      {status.lastActivity && (
        <p>Последняя активность: {formatLastActivity(status.lastActivity)}</p>
      )}
      {status.lastHeartbeatCheck && (
        <p>Последняя проверка: {formatLastActivity(status.lastHeartbeatCheck)}</p>
      )}
      {status.lastHeartbeatStatus !== null && (
        <p>Heartbeat: {status.lastHeartbeatStatus ? '✅' : '❌'}</p>
      )}
      {status.consecutiveHeartbeatFailures !== undefined && status.consecutiveHeartbeatFailures > 0 && (
        <p className="text-red-500">Неудачных проверок: {status.consecutiveHeartbeatFailures}</p>
      )}
      {status.lastError && (
        <p className="text-red-500">Ошибка: {status.lastError}</p>
      )}
      {status.lastInvokeMethod && (
        <p>Последний метод: {status.lastInvokeMethod}</p>
      )}
      {status.lastInvokeDuration !== undefined && (
        <p>Длительность: {status.lastInvokeDuration}ms</p>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            {status.isConnected ? (
              <Wifi className={cn('w-4 h-4', getStatusColor())} />
            ) : (
              <WifiOff className={cn('w-4 h-4', getStatusColor())} />
            )}
            {showDetails && (
              <>
                {getStatusBadge()}
                {status.lastActivity && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatLastActivity(status.lastActivity)}
                  </span>
                )}
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
