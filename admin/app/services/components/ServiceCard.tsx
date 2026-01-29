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
  imageUrl?: string;
  category?: string;
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
          <div className="flex gap-4 mb-4">
            {service.imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={service.imageUrl}
                  alt={service.name}
                  className="w-24 h-24 object-cover rounded-lg border border-border"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {service.isCategory ? (
                  <FolderTree className="h-5 w-5 text-primary" />
                ) : service.subcategories && service.subcategories.length > 0 ? (
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                ) : (
                  <FolderOpen className="h-5 w-5 text-green-500" />
                )}
                <h3 className="text-lg font-semibold">{service.name}</h3>
                {service.isCategory ? (
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Категория
                  </Badge>
                ) : service.subcategories && service.subcategories.length > 0 ? (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                    Услуга с подкатегориями
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                    Самостоятельная услуга
                  </Badge>
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
          
          {service.category && !service.isCategory && (
            <div className="mb-2">
              <Badge variant="outline" className="text-xs">
                Категория: {service.category}
              </Badge>
            </div>
          )}
          
          {service.isCategory ? (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                  Категория
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Без цены и времени, используется для группировки подкатегорий
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <span className="text-2xl font-bold text-primary">{Number(service.price).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽</span>
                <span className="text-sm text-muted-foreground ml-2">{service.duration} мин</span>
              </div>
              <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                {service.subcategories && service.subcategories.length > 0 ? 'Услуга с подкатегориями' : 'Самостоятельная услуга'}
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

