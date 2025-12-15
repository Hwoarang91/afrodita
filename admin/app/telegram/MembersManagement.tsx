'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ChatSelector from './ChatSelector';

export default function MembersManagement() {
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [memberInfo, setMemberInfo] = useState<any>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(false);
  const [restrictPermissions, setRestrictPermissions] = useState({
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
  });
  const [promotePermissions, setPromotePermissions] = useState({
    can_manage_chat: false,
    can_delete_messages: false,
    can_manage_video_chats: false,
    can_restrict_members: false,
    can_promote_members: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
  });

  const getMemberInfoMutation = useMutation({
    mutationFn: async ({ chatId, userId }: { chatId: string; userId: string }) => {
      const { data } = await apiClient.get(`/telegram/get-chat-member?chatId=${chatId}&userId=${userId}`);
      return data.result;
    },
    onSuccess: (data) => {
      setMemberInfo(data);
      setIsLoadingMember(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при получении информации об участнике');
      setIsLoadingMember(false);
    },
  });

  const banMutation = useMutation({
    mutationFn: async (data: { chatId: string; userId: number }) => {
      return await apiClient.post('/telegram/ban-chat-member', data);
    },
    onSuccess: () => {
      toast.success('Участник забанен');
      if (selectedChatId && userId) {
        getMemberInfoMutation.mutate({ chatId: selectedChatId, userId });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при бане участника');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (data: { chatId: string; userId: number }) => {
      return await apiClient.post('/telegram/unban-chat-member', data);
    },
    onSuccess: () => {
      toast.success('Участник разбанен');
      if (selectedChatId && userId) {
        getMemberInfoMutation.mutate({ chatId: selectedChatId, userId });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при разбане участника');
    },
  });

  const restrictMutation = useMutation({
    mutationFn: async (data: { chatId: string; userId: number; permissions: any }) => {
      return await apiClient.post('/telegram/restrict-chat-member', data);
    },
    onSuccess: () => {
      toast.success('Права участника ограничены');
      if (selectedChatId && userId) {
        getMemberInfoMutation.mutate({ chatId: selectedChatId, userId });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при ограничении прав участника');
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (data: { chatId: string; userId: number; permissions?: any }) => {
      return await apiClient.post('/telegram/promote-chat-member', data);
    },
    onSuccess: () => {
      toast.success('Участник повышен до администратора');
      if (selectedChatId && userId) {
        getMemberInfoMutation.mutate({ chatId: selectedChatId, userId });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при повышении участника');
    },
  });

  const handleGetMemberInfo = () => {
    if (!selectedChatId || !userId) {
      toast.error('Введите ID чата и ID пользователя');
      return;
    }
    setIsLoadingMember(true);
    getMemberInfoMutation.mutate({ chatId: selectedChatId, userId });
  };

  return (
    <div className="bg-card rounded-lg shadow p-6 border border-border">
      <h2 className="text-xl font-semibold text-foreground mb-4">Управление участниками групп</h2>

      <div className="space-y-4">
        <ChatSelector value={selectedChatId} onChange={setSelectedChatId} />

        <div>
          <Label htmlFor="userId">ID пользователя</Label>
          <Input
            id="userId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Введите Telegram ID пользователя"
          />
        </div>

        <Button onClick={handleGetMemberInfo} disabled={isLoadingMember || !selectedChatId || !userId}>
          {isLoadingMember ? 'Загрузка...' : 'Получить информацию об участнике'}
        </Button>

        {memberInfo && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Информация об участнике</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Имя:</strong> {memberInfo.user?.first_name} {memberInfo.user?.last_name}
              </p>
              <p>
                <strong>Username:</strong> @{memberInfo.user?.username || 'не указан'}
              </p>
              <p>
                <strong>ID:</strong> {memberInfo.user?.id}
              </p>
              <p>
                <strong>Статус:</strong> {memberInfo.status}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => banMutation.mutate({ chatId: selectedChatId, userId: parseInt(userId, 10) })}
                  disabled={memberInfo.status === 'kicked' || banMutation.isPending}
                >
                  {banMutation.isPending ? 'Бан...' : 'Забанить'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unbanMutation.mutate({ chatId: selectedChatId, userId: parseInt(userId, 10) })}
                  disabled={memberInfo.status !== 'kicked' || unbanMutation.isPending}
                >
                  {unbanMutation.isPending ? 'Разбан...' : 'Разбанить'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    restrictMutation.mutate({
                      chatId: selectedChatId,
                      userId: parseInt(userId, 10),
                      permissions: restrictPermissions,
                    })
                  }
                  disabled={memberInfo.status === 'kicked' || restrictMutation.isPending}
                >
                  {restrictMutation.isPending ? 'Ограничение...' : 'Ограничить права'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    promoteMutation.mutate({
                      chatId: selectedChatId,
                      userId: parseInt(userId, 10),
                      permissions: promotePermissions,
                    })
                  }
                  disabled={
                    memberInfo.status === 'kicked' ||
                    memberInfo.status === 'administrator' ||
                    promoteMutation.isPending
                  }
                >
                  {promoteMutation.isPending ? 'Повышение...' : 'Повысить до админа'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

