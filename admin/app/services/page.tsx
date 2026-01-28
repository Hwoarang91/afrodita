'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useState, useMemo } from 'react';
import { ExportButton } from '../components/ExportButton';
import { exportServices } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ServiceCard } from './components/ServiceCard';
import { ServiceModal } from './components/ServiceModal';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  category?: string;
  isActive: boolean;
  isCategory?: boolean;
  parentServiceId?: string | null;
  parentService?: Service | null;
  subcategories?: Service[];
  allowMultipleSubcategories?: boolean;
  masters?: Array<{ id: string; name: string }>;
  imageUrl?: string;
}

export default function ServicesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [parentServiceForSubcategory, setParentServiceForSubcategory] = useState<Service | null>(null);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const limit = 20;

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['services', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', {
        params: {
          page,
          limit,
          includeSubcategories: true, // Включаем подкатегории
        },
      });
      return data;
    },
  });

  // Для экспорта загружаем все услуги
  const { data: allServicesData } = useQuery({
    queryKey: ['services-all'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', {
        params: {
          page: 1,
          limit: 1000, // Большой лимит для экспорта
        },
      });
      return data;
    },
  });

  const services = useMemo(() => servicesData?.data || [], [servicesData?.data]);
  const totalPages = useMemo(() => servicesData?.totalPages || 1, [servicesData?.totalPages]);
  const exportData = useMemo(() => 
    allServicesData?.data ? exportServices(allServicesData.data) : [],
    [allServicesData?.data]
  );
  
  // Фильтруем только основные услуги (без подкатегорий) на верхнем уровне
  const mainServices = useMemo(() => 
    services?.filter((s: Service) => !s.parentServiceId) || [],
    [services]
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Услуги</h1>
        <div className="flex gap-2">
          {services && services.length > 0 && (
            <ExportButton
              data={exportData}
              filename="services"
              title="Услуги"
              headers={exportData[0]}
            />
          )}
          <Button
            onClick={() => {
              setEditingService(null);
              setIsModalOpen(true);
            }}
          >
            + Добавить услугу
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {mainServices.map((service: Service) => {
          const isExpanded = expandedServices.has(service.id);
          
          return (
            <ServiceCard
              key={service.id}
              service={service}
              isExpanded={isExpanded}
              onToggleExpand={() => {
                const newExpanded = new Set(expandedServices);
                if (isExpanded) {
                  newExpanded.delete(service.id);
                } else {
                  newExpanded.add(service.id);
                }
                setExpandedServices(newExpanded);
              }}
              onEdit={(service) => {
                setEditingService(service);
                setParentServiceForSubcategory(null);
                setIsModalOpen(true);
              }}
              onDelete={(serviceId) => {
                deleteMutation.mutate(serviceId);
              }}
              onAddSubcategory={(service) => {
                setParentServiceForSubcategory(service);
                setEditingService(null);
                setIsModalOpen(true);
              }}
              onEditSubcategory={(subcategory) => {
                setEditingService(subcategory);
                setParentServiceForSubcategory(null);
                setIsModalOpen(true);
              }}
              onDeleteSubcategory={(subcategoryId) => {
                deleteMutation.mutate(subcategoryId);
              }}
            />
          );
        })}
      </div>

        {(!services || services.length === 0) && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">Услуги не найдены</div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page} из {totalPages} (Всего: {servicesData?.total || 0})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
          >
            Вперед
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <ServiceModal
        service={editingService}
        parentServiceForSubcategory={parentServiceForSubcategory}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingService(null);
          setParentServiceForSubcategory(null);
        }}
      />
    </div>
  );
}

