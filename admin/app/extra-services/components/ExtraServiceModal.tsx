'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExtraServiceForm } from './ExtraServiceForm';
import type { ExtraService } from '../page';

interface ExtraServiceModalProps {
  open: boolean;
  onClose: () => void;
  item: ExtraService | null;
  onSuccess: () => void;
}

export function ExtraServiceModal({ open, onClose, item, onSuccess }: ExtraServiceModalProps) {
  const mutation = useMutation({
    mutationFn: async (data: { name: string; description: string; price: number; icon: string; isActive: boolean }) => {
      if (item?.id) {
        await apiClient.put(`/extra-services/${item.id}`, data);
      } else {
        await apiClient.post('/extra-services', data);
      }
    },
    onSuccess: () => {
      toast.success(item ? 'Доп. услуга обновлена' : 'Доп. услуга добавлена');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка сохранения');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Редактировать доп. услугу' : 'Добавить доп. услугу'}</DialogTitle>
        </DialogHeader>
        <ExtraServiceForm
          item={item}
          onSubmit={(data) => mutation.mutate(data)}
          isLoading={mutation.isPending}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
