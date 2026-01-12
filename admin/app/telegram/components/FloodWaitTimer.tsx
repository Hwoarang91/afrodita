'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FloodWaitEvent {
  sessionId: string;
  userId?: string;
  waitTime: number; // В секундах
  method?: string;
  timestamp: string;
}

interface FloodWaitTimerProps {
  event: FloodWaitEvent | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Компонент для отображения таймера FloodWait разблокировки
 */
export function FloodWaitTimer({ event, onDismiss, className }: FloodWaitTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number>(0);

  // Инициализация таймера при получении нового события
  useEffect(() => {
    if (!event) {
      setRemainingSeconds(0);
      setIsExpired(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Вычисляем время окончания блокировки
    const eventTime = new Date(event.timestamp).getTime();
    const waitTimeMs = event.waitTime * 1000;
    const endTime = eventTime + waitTimeMs;
    endTimeRef.current = endTime;

    // Обновляем таймер
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

      if (remaining <= 0) {
        setRemainingSeconds(0);
        setIsExpired(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setRemainingSeconds(remaining);
      }
    };

    // Первое обновление
    updateTimer();

    // Обновляем каждую секунду
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [event]);

  // Форматирование времени
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) {
      return '0:00';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Если нет события, не показываем компонент
  if (!event) {
    return null;
  }

  return (
    <Alert
      className={cn(
        'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
          <div className="flex-1">
            <AlertTitle className="text-orange-900 dark:text-orange-100 mb-1">
              FloodWait: Превышен лимит запросов
            </AlertTitle>
            <AlertDescription className="text-orange-800 dark:text-orange-200 space-y-2">
              <p>
                Telegram временно ограничил запросы. Необходимо подождать перед следующим запросом.
              </p>
              {event.method && (
                <p className="text-sm opacity-80">
                  Метод: <code className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/50 rounded text-xs">{event.method}</code>
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Clock className="h-4 w-4" />
                <span className="font-mono font-semibold text-lg">
                  {isExpired ? 'Готово' : formatTime(remainingSeconds)}
                </span>
                {!isExpired && (
                  <span className="text-sm opacity-70">
                    до разблокировки
                  </span>
                )}
              </div>
            </AlertDescription>
          </div>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/50"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  );
}
