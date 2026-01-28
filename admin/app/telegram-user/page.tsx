'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, MessageSquare } from 'lucide-react';
import { useTelegramSession, type TelegramSessionStatus } from '@/lib/hooks/useTelegramSession';
import TelegramAuthTab from '../telegram/TelegramAuthTab';
import TelegramUserMessagesTab from '../telegram/TelegramUserMessagesTab';
import { TelegramHeader } from '../telegram/components/TelegramHeader';
import { TelegramStatusPanel } from '../telegram/components/TelegramStatusPanel';
import { ErrorCard } from '../telegram/components/ErrorCard';

export default function TelegramUserPage() {
  const { data: sessionData, status, isLoading: isLoadingSession } = useTelegramSession();
  const sessionStatus = status as TelegramSessionStatus;
  const [mainTab, setMainTab] = useState<'auth' | 'user'>('auth');

  const uiStatus: TelegramSessionStatus = sessionStatus || 'none';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Telegram User</h1>
        <p className="text-muted-foreground">
          Авторизация и отправка личных сообщений от своего лица (User API)
        </p>
      </div>

      <TelegramHeader status={uiStatus} />
      {uiStatus !== 'none' && uiStatus !== 'active' && (
        <TelegramStatusPanel status={uiStatus} />
      )}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'auth' | 'user')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="auth">
            <Shield className="w-4 h-4 mr-2" />
            Авторизация
          </TabsTrigger>
          <TabsTrigger value="user">
            <MessageSquare className="w-4 h-4 mr-2" />
            Личные сообщения
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="space-y-6">
          {isLoadingSession ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-6 w-64" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <p className="text-muted-foreground text-sm">Проверка статуса Telegram сессии...</p>
              </CardContent>
            </Card>
          ) : sessionStatus === 'error' ? (
            <ErrorCard
              title="Ошибка подключения Telegram"
              message={sessionData?.invalidReason || 'Не удалось подключить Telegram аккаунт'}
              actionText="Повторить"
              onAction={() => window.location.reload()}
            />
          ) : sessionStatus === 'expired' ? (
            <div className="space-y-4">
              <ErrorCard
                title="Telegram сессия истекла"
                message={
                  sessionData?.invalidReason ||
                  'Сессия Telegram была отозвана или истекла. Пожалуйста, переавторизуйтесь.'
                }
                actionText="Переавторизоваться"
                onAction={() => setMainTab('auth')}
              />
              <TelegramAuthTab onAuthSuccess={() => setMainTab('user')} />
            </div>
          ) : sessionStatus === 'active' ? (
            <div className="space-y-4">
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardContent className="pt-6">
                  <p className="text-green-800 dark:text-green-200">
                    Telegram аккаунт подключен. Перейдите на вкладку «Личные сообщения» для работы.
                  </p>
                  {sessionData?.phoneNumber && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                      Телефон: {sessionData.phoneNumber}
                    </p>
                  )}
                </CardContent>
              </Card>
              <TelegramAuthTab onAuthSuccess={() => setMainTab('user')} />
            </div>
          ) : (
            <TelegramAuthTab onAuthSuccess={() => setMainTab('user')} />
          )}
        </TabsContent>

        <TabsContent value="user">
          <TelegramUserMessagesTab onRequestAuth={() => setMainTab('auth')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
