'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CountdownTimerProps {
  initialSeconds: number;
  onExpire?: () => void;
  onReset?: () => void;
  showResetButton?: boolean;
  resetButtonText?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

export function CountdownTimer({
  initialSeconds,
  onExpire,
  onReset,
  showResetButton = true,
  resetButtonText = 'Запросить код повторно',
  className,
  variant = 'default',
}: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (seconds <= 0) {
      setIsExpired(true);
      if (onExpire) {
        onExpire();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          if (onExpire) {
            onExpire();
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [seconds, onExpire]);

  const handleReset = () => {
    setSeconds(initialSeconds);
    setIsExpired(false);
    if (onReset) {
      onReset();
    }
  };

  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {!isExpired ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(seconds)}</span>
          </div>
        ) : (
          showResetButton &&
          onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8"
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              {resetButtonText}
            </Button>
          )
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {!isExpired ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Код действителен: {formatTime(seconds)}</span>
        </div>
      ) : (
        showResetButton &&
        onReset && (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {resetButtonText}
          </Button>
        )
      )}
    </div>
  );
}
