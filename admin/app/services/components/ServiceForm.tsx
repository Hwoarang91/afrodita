'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

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

interface ServiceFormProps {
  service: Service | null | undefined;
  parentServiceForSubcategory: Service | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onCancel: () => void;
}

type ServiceType = 'main' | 'category' | 'subcategory';

export function ServiceForm({
  service,
  parentServiceForSubcategory,
  onSubmit,
  isLoading,
  onCancel,
}: ServiceFormProps) {
  const [serviceType, setServiceType] = useState<ServiceType>('main');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    duration: 60,
    category: '',
    isActive: true,
    isCategory: false,
    parentServiceId: null as string | null,
    allowMultipleSubcategories: false,
    masterIds: [] as string[],
  });

  const currentService = service;
  const isCategory = currentService?.isCategory || serviceType === 'category';
  const initialParentServiceId = parentServiceForSubcategory?.id || currentService?.parentServiceId || null;

  useEffect(() => {
    if (currentService) {
      setServiceType(currentService.isCategory ? 'category' : (currentService.parentServiceId ? 'subcategory' : 'main'));
      setFormData({
        name: currentService.name || '',
        description: currentService.description || '',
        price: currentService.price || 0,
        duration: currentService.duration || 60,
        category: currentService.category || '',
        isActive: currentService.isActive ?? true,
        isCategory: currentService.isCategory || false,
        parentServiceId: currentService.parentServiceId || null,
        allowMultipleSubcategories: currentService.allowMultipleSubcategories || false,
        masterIds: currentService.masters?.map((m: any) => m.id) || [],
      });
    } else if (parentServiceForSubcategory) {
      setServiceType('subcategory');
      setFormData({
        name: '',
        description: '',
        price: 0,
        duration: 60,
        category: '',
        isActive: true,
        isCategory: false,
        parentServiceId: parentServiceForSubcategory.id,
        allowMultipleSubcategories: false,
        masterIds: [],
      });
    } else {
      setServiceType('main');
      setFormData({
        name: '',
        description: '',
        price: 0,
        duration: 60,
        category: '',
        isActive: true,
        isCategory: false,
        parentServiceId: null,
        allowMultipleSubcategories: false,
        masterIds: [],
      });
    }
  }, [currentService, parentServiceForSubcategory]);

  const { data: mastersData } = useQuery({
    queryKey: ['masters'],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters');
      return Array.isArray(data) ? data : (data?.data || []);
    },
  });
  
  const masters = Array.isArray(mastersData) ? mastersData : (mastersData?.data || []);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['services-categories'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/services/categories');
        return Array.isArray(data) ? data : [];
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Ошибка при загрузке категорий:', error);
        }
        return [];
      }
    },
    enabled: serviceType === 'subcategory' || !service,
  });

  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: any = {
      name: formData.name,
      description: formData.description,
      isActive: formData.isActive,
      masterIds: formData.masterIds,
      isCategory: serviceType === 'category',
      ...(serviceType !== 'category' && {
        price: formData.price,
        duration: formData.duration,
      }),
      ...(serviceType === 'subcategory' && {
        parentServiceId: formData.parentServiceId || null,
      }),
      ...(serviceType === 'category' && {
        allowMultipleSubcategories: formData.allowMultipleSubcategories || false,
      }),
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!service && !parentServiceForSubcategory && (
        <div className="space-y-2">
          <Label>Тип услуги *</Label>
          <div className="flex flex-col gap-3">
            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-accent">
              <input
                type="radio"
                name="serviceType"
                checked={serviceType === 'main'}
                onChange={() => {
                  setServiceType('main');
                  setFormData({
                    ...formData,
                    isCategory: false,
                    parentServiceId: null,
                    allowMultipleSubcategories: false,
                    price: formData.price || 0,
                    duration: formData.duration || 60,
                  });
                }}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium">Самостоятельная услуга</span>
                <p className="text-xs text-muted-foreground">Имеет цену и время</p>
              </div>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-accent">
              <input
                type="radio"
                name="serviceType"
                checked={serviceType === 'category'}
                onChange={() => {
                  setServiceType('category');
                  setFormData({
                    ...formData,
                    isCategory: true,
                    parentServiceId: null,
                    price: 0,
                    duration: 0,
                    allowMultipleSubcategories: formData.allowMultipleSubcategories || false,
                  });
                }}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium">Категория</span>
                <p className="text-xs text-muted-foreground">Без цены и времени, только название</p>
              </div>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-accent">
              <input
                type="radio"
                name="serviceType"
                checked={serviceType === 'subcategory'}
                onChange={() => {
                  setServiceType('subcategory');
                  setFormData({
                    ...formData,
                    isCategory: false,
                    parentServiceId: formData.parentServiceId || null,
                    allowMultipleSubcategories: false,
                    price: formData.price || 0,
                    duration: formData.duration || 60,
                  });
                }}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium">Подкатегория</span>
                <p className="text-xs text-muted-foreground">Имеет цену и время, привязана к категории</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {serviceType === 'subcategory' && (
        <div className="space-y-2">
          <Label htmlFor="parentServiceId">Родительская категория *</Label>
          <select
            id="parentServiceId"
            value={formData.parentServiceId || ''}
            onChange={(e) => {
              const parentId = e.target.value || null;
              setFormData({
                ...formData,
                parentServiceId: parentId,
              });
            }}
            disabled={!!parentServiceForSubcategory}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            required
          >
            <option value="">Выберите категорию</option>
            {categoriesLoading ? (
              <option value="" disabled>Загрузка категорий...</option>
            ) : categories && categories.length > 0 ? (
              categories
                .filter((s: Service) => s.id !== service?.id)
                .map((s: Service) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
            ) : (
              <option value="" disabled>Нет доступных категорий</option>
            )}
          </select>
          {parentServiceForSubcategory && (
            <p className="text-xs text-muted-foreground">
              Родительская категория: <strong>{parentServiceForSubcategory.name}</strong>
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Название *</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          required
        />
      </div>

      {serviceType !== 'category' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Цена (₽) *</Label>
            <Input
              id="price"
              type="number"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Длительность (мин) *</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
              required
            />
          </div>
        </div>
      )}

      {serviceType === 'category' && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="allowMultipleSubcategories"
            checked={formData.allowMultipleSubcategories}
            onChange={(e) => setFormData({ ...formData, allowMultipleSubcategories: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="allowMultipleSubcategories" className="cursor-pointer">
            Разрешить выбор нескольких подкатегорий
          </Label>
        </div>
      )}

      <div className="space-y-2">
        <Label>Мастера</Label>
        <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-muted/50">
          {masters?.map((master: any) => (
            <label key={master.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={formData.masterIds.includes(master.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      masterIds: [...formData.masterIds, master.id],
                    });
                  } else {
                    setFormData({
                      ...formData,
                      masterIds: formData.masterIds.filter((id) => id !== master.id),
                    });
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">{master.name}</span>
            </label>
          ))}
          {(!masters || masters.length === 0) && (
            <p className="text-sm text-muted-foreground">Нет доступных мастеров</p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="isActive" className="cursor-pointer">Активна</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            service ? 'Сохранить' : 'Создать'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

