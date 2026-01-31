'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useState } from 'react';
import { ExtraServiceModal } from './components/ExtraServiceModal';
import { ExtraServiceCard } from './components/ExtraServiceCard';

export interface ExtraService {
  id: string;
  name: string;
  description?: string;
  price: number;
  icon?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ExtraServicesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtraService | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['extra-services'],
    queryFn: async () => {
      const { data: res } = await apiClient.get('/extra-services', {
        params: { page: 1, limit: 100 },
      });
      return Array.isArray(res) ? { data: res, total: res.length, page: 1, totalPages: 1 } : res;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/extra-services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Доп. услуга удалена');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Не удалось удалить');
    },
  });

  const list = (data?.data ?? data) as ExtraService[] | undefined;
  const items = Array.isArray(list) ? list : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Доп. услуги</h1>
        <Button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить доп. услугу
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ExtraServiceCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Доп. услуг пока нет. Добавьте первую.</div>
      )}

      <ExtraServiceModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['extra-services'] });
          setIsModalOpen(false);
          setEditingItem(null);
        }}
      />
    </div>
  );
}
