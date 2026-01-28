'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, Edit, Trash2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isActive: boolean;
  imageUrl?: string;
}

interface SubcategoryListProps {
  subcategories: Service[];
  onEdit: (subcategory: Service) => void;
  onDelete: (subcategoryId: string) => void;
}

export const SubcategoryList = memo(({
  subcategories,
  onEdit,
  onDelete,
}: SubcategoryListProps) => {
  return (
    <div className="ml-4 space-y-2 border-l-2 border-l-muted pl-4">
      {subcategories.map((sub) => (
        <Card key={sub.id} className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              {sub.imageUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={sub.imageUrl}
                    alt={sub.name}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{sub.name}</span>
                  {!sub.isActive && (
                    <Badge variant="secondary" className="text-xs">Неактивна</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground ml-6">
                  {sub.price}₽ • {sub.duration} мин
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(sub)}
                  title="Редактировать подкатегорию"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(sub.id)}
                  title="Удалить подкатегорию"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

SubcategoryList.displayName = 'SubcategoryList';

