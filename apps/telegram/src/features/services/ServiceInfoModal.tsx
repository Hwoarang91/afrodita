import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Service } from '@shared/types';

interface ServiceInfoModalProps {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServiceInfoModal({ service, open, onOpenChange }: ServiceInfoModalProps) {
  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#2D1B22] dark:text-white">
            {service.name}
          </DialogTitle>
          {service.category && (
            <DialogDescription className="text-pink-500 dark:text-pink-400 text-sm font-semibold uppercase">
              {service.category}
            </DialogDescription>
          )}
        </DialogHeader>
        
        {service.imageUrl && (
          <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
            <img
              src={service.imageUrl}
              alt={service.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {service.description && (
          <div className="mb-4">
            <p className="text-sm text-gray-700 dark:text-pink-200/80 leading-relaxed">
              {service.description}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-pink-100 dark:border-pink-900/30">
          <div className="flex items-center gap-2 text-gray-600 dark:text-pink-300/60">
            <span className="material-symbols-outlined text-lg">schedule</span>
            <span className="text-sm font-medium">{service.duration} минут</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-primary">
              {Number(service.price).toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
