'use client';

import { Loader2, AlertCircle, Lock } from 'lucide-react';

interface TelegramLoadingProps {
  status: 'initializing' | 'invalid' | 'revoked' | 'expired';
  message?: string;
  invalidReason?: string | null;
}

export function TelegramLoading({ status, message, invalidReason }: TelegramLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      {status === 'initializing' && (
        <>
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {message || 'Авторизация Telegram...'}
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            Это может занять несколько секунд
          </p>
        </>
      )}
      
      {(status === 'invalid' || status === 'expired') && (
        <>
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Telegram сессия {status === 'invalid' ? 'невалидна' : 'истекла'}
          </p>
          {invalidReason && (
            <p className="text-gray-500 dark:text-gray-500 text-sm">
              Причина: {invalidReason}
            </p>
          )}
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            Пожалуйста, переавторизуйте свой Telegram аккаунт
          </p>
        </>
      )}
      
      {status === 'revoked' && (
        <>
          <Lock className="w-12 h-12 text-orange-500" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Telegram сессия была отозвана
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            Пожалуйста, войдите снова для продолжения работы
          </p>
        </>
      )}
    </div>
  );
}

