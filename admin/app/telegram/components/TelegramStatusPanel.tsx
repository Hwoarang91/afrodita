'use client';

import { TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TelegramStatusPanelProps {
  status: TelegramSessionStatus;
}

const steps = [
  { key: 'none' as const, label: 'Старт' },
  { key: 'initializing' as const, label: 'Авторизация' },
  { key: 'waiting_2fa' as const, label: '2FA' },
  { key: 'active' as const, label: 'Готово' },
];

export function TelegramStatusPanel({ status }: TelegramStatusPanelProps) {
  const getStepIndex = (stepStatus: TelegramSessionStatus): number => {
    switch (stepStatus) {
      case 'none':
        return 0;
      case 'initializing':
        return 1;
      case 'waiting_2fa':
        return 2;
      case 'active':
        return 3;
      case 'expired':
      case 'error':
        return -1; // Показываем все шаги как неактивные при ошибке
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(status);
  const isErrorState = status === 'expired' || status === 'error';

  return (
    <div className="flex gap-2 my-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div
            key={step.key}
            className={cn(
              'flex-1 text-center py-3 rounded-lg transition-all duration-300 relative',
              isCompleted && !isErrorState
                ? 'bg-primary text-primary-foreground shadow-sm'
                : isCurrent && !isErrorState
                ? 'bg-primary/80 text-primary-foreground shadow-sm ring-2 ring-primary ring-offset-2'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {isCompleted && !isErrorState ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
              )}
              <span className="text-sm font-medium">{step.label}</span>
            </div>
            {isCurrent && !isErrorState && (
              <div className="mt-2">
                <div className="h-1 bg-primary-foreground/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-foreground/50 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

