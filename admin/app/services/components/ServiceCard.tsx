'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderTree, FolderOpen, Edit, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { SubcategoryList } from './SubcategoryList';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isActive: boolean;
  isCategory?: boolean;
  subcategories?: Service[];
  allowMultipleSubcategories?: boolean;
}

interface ServiceCardProps {
  service: Service;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (service: Service) => void;
  onDelete: (serviceId: string) => void;
  onAddSubcategory: (service: Service) => void;
  onEditSubcategory: (subcategory: Service) => void;
  onDeleteSubcategory: (subcategoryId: string) => void;
}

export const ServiceCard = memo(({
  service,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
}: ServiceCardProps) => {
  const subcategoriesCount = service.subcategories?.length || 0;

  return (
    <div className="space-y-2">
      <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {service.isCategory ? (
                  <FolderTree className="h-5 w-5 text-primary" />
                ) : (
                  <FolderOpen className="h-5 w-5 text-primary" />
                )}
                <h3 className="text-lg font-semibold">{service.name}</h3>
                {service.isCategory && (
                  <Badge variant="secondary" className="text-xs">Категория</Badge>
                )}
                {service.allowMultipleSubcategories && (
                  <Badge variant="outline" className="text-xs">Множественный выбор</Badge>
                )}
                {subcategoriesCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {subcategoriesCount} {subcategoriesCount === 1 ? 'подкатегория' : 'подкатегорий'}
                  </Badge>
                )}
              </div>
              {!service.isActive && (
                <Badge variant="secondary" className="mt-1">Неактивна</Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{service.description}</p>
          
          {!service.isCategory && (
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-2xl font-bold text-primary">{service.price} ₽</span>
                <span className="text-sm text-muted-foreground ml-2">{service.duration} мин</span>
              </div>
            </div>
          )}
          
          {service.isCategory && (
            <div className="mb-4">
              <Badge variant="outline" className="text-xs">
                Категория (без цены и времени)
              </Badge>
            </div>
          )}
          
          {subcategoriesCount > 0 && (
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="w-full justify-between mb-2"
              >
                <span className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="text-sm font-medium">
                    Подкатегории ({subcategoriesCount})
                  </span>
                </span>
              </Button>
              
              {isExpanded && (
                <SubcategoryList
                  subcategories={service.subcategories || []}
                  onEdit={onEditSubcategory}
                  onDelete={onDeleteSubcategory}
                />
              )}
            </div>
          )}
          
          <div className="flex space-x-2">
            {service.isCategory && (
              <Button
                variant="outline"
                onClick={() => onAddSubcategory(service)}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить подкатегорию
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => onEdit(service)}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDelete(service.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ServiceCard.displayName = 'ServiceCard';

