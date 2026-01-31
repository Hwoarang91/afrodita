'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import type { ExtraService } from '../page';

const ICON_OPTIONS = ['spa', 'fireplace', 'water_drop', 'self_improvement', 'local_florist', 'bedtime', 'volunteer_activism', 'favorite'];

interface ExtraServiceFormProps {
  item: ExtraService | null;
  onSubmit: (data: { name: string; description: string; price: number; icon: string; isActive: boolean }) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export function ExtraServiceForm({ item, onSubmit, isLoading, onCancel }: ExtraServiceFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [icon, setIcon] = useState('spa');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description ?? '');
      setPrice(typeof item.price === 'number' ? item.price : parseFloat(String(item.price)));
      setIcon(item.icon ?? 'spa');
      setIsActive(item.isActive);
    } else {
      setName('');
      setDescription('');
      setPrice(0);
      setIcon('spa');
      setIsActive(true);
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), price: Number(price) || 0, icon: icon || 'spa', isActive });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Название</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Ароматерапия"
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Описание</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание для клиента"
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="price">Цена (₽)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={100}
            value={price || ''}
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Иконка (Material)</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIcon(opt)}
                className={`px-3 py-1.5 rounded-md text-sm border transition ${
                  icon === opt
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 border-border hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="spa"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="isActive" checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
          <Label htmlFor="isActive">Активна (отображается в веб-приложении)</Label>
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {item ? 'Сохранить' : 'Добавить'}
        </Button>
      </DialogFooter>
    </form>
  );
}
