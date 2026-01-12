'use client';

import { Check, CheckCheck, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageDeliveryStatusProps {
  out: boolean;
  readOutbox?: boolean | null; // Для исходящих: прочитано получателем
  readInbox?: boolean | null; // Для входящих: прочитано отправителем
  className?: string;
}

/**
 * Компонент для отображения статуса доставки сообщения
 * 
 * Для исходящих сообщений:
 * - Одна серая галочка: отправлено (readOutbox = false)
 * - Две серые галочки: доставлено (readOutbox = true, но не прочитано)
 * - Две синие галочки: прочитано (readOutbox = true и прочитано)
 * 
 * Для входящих сообщений:
 * - Иконка глаза: прочитано отправителем (readInbox = true)
 */
export function MessageDeliveryStatus({
  out,
  readOutbox,
  readInbox,
  className,
}: MessageDeliveryStatusProps) {
  // Для исходящих сообщений
  if (out) {
    // Прочитано получателем (две синие галочки)
    if (readOutbox === true) {
      return (
        <div className={cn('flex items-center gap-0.5', className)}>
          <CheckCheck className="w-4 h-4 text-primary" />
        </div>
      );
    }
    
    // Отправлено, но не доставлено (одна серая галочка)
    // В Telegram обычно всегда доставлено, но на всякий случай
    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        <Check className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  // Для входящих сообщений
  // Показываем иконку глаза, если прочитано отправителем
  if (readInbox === true) {
    return (
      <div className={cn('flex items-center', className)}>
        <Eye className="w-4 h-4 text-primary" />
      </div>
    );
  }

  // Для входящих, если не прочитано - не показываем статус
  return null;
}
