'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ServiceForm } from './ServiceForm';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  isActive: boolean;
  isCategory?: boolean;
  parentServiceId?: string | null;
  allowMultipleSubcategories?: boolean;
  masters?: Array<{ id: string; name: string }>;
}

interface ServiceModalProps {
  service: Service | null;
  parentServiceForSubcategory: Service | null;
  open: boolean;
  onClose: () => void;
}

export function ServiceModal({
  service,
  parentServiceForSubcategory,
  open,
  onClose,
}: ServiceModalProps) {
  const queryClient = useQueryClient();

  // Загружаем полные данные услуги при редактировании
  const { data: serviceData } = useQuery({
    queryKey: ['service', service?.id],
    queryFn: async () => {
      if (service?.id) {
        const { data } = await apiClient.get(`/services/${service.id}`);
        return data;
      }
      return null;
    },
    enabled: !!service?.id,
  });

  const currentService = serviceData || service;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (service) {
        await apiClient.put(`/services/${service.id}`, data);
      } else {
        await apiClient.post('/services', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-main'] });
      onClose();
    },
    onError: (error: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Ошибка при сохранении услуги:', error);
      }
      toast.error(`Ошибка: ${error.response?.data?.message || error.message || 'Не удалось сохранить услугу'}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {service 
              ? (currentService?.isCategory ? 'Редактировать категорию' : currentService?.parentServiceId ? 'Редактировать подкатегорию' : 'Редактировать услугу')
              : (parentServiceForSubcategory ? 'Добавить подкатегорию' : 'Добавить услугу')
            }
          </DialogTitle>
          <DialogDescription>
            {service 
              ? (currentService?.isCategory ? 'Обновите информацию о категории' : currentService?.parentServiceId ? 'Обновите информацию о подкатегории' : 'Обновите информацию об услуге')
              : (parentServiceForSubcategory 
                  ? `Добавьте подкатегорию для категории "${parentServiceForSubcategory?.name || ''}"`
                  : 'Заполните информацию о новой услуге'
                )
            }
          </DialogDescription>
        </DialogHeader>
        <ServiceForm
          service={currentService}
          parentServiceForSubcategory={parentServiceForSubcategory}
          onSubmit={(data) => mutation.mutate(data)}
          isLoading={mutation.isPending}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

