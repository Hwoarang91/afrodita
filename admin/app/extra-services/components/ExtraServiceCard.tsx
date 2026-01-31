'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import type { ExtraService } from '../page';

interface ExtraServiceCardProps {
  item: ExtraService;
  onEdit: () => void;
  onDelete: () => void;
}

export function ExtraServiceCard({ item, onEdit, onDelete }: ExtraServiceCardProps) {
  const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));

  return (
    <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          {!item.isActive && (
            <Badge variant="secondary" className="shrink-0">
              Неактивна
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={onEdit} title="Редактировать">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete} title="Удалить">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        {item.icon && (
          <p className="text-xs text-muted-foreground mt-2">Иконка: {item.icon}</p>
        )}
      </CardContent>
    </Card>
  );
}
