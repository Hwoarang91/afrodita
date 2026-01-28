import { useState } from 'react';
import type { Service } from '@shared/types';
import ServiceInfoModal from './ServiceInfoModal';

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onToggle: () => void;
  onInfoClick: () => void;
}

export default function ServiceCard({ service, isSelected, onToggle, onInfoClick }: ServiceCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
    onInfoClick();
  };

  return (
    <>
      <ServiceInfoModal 
        service={service} 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    <div
      className={`group relative flex items-stretch justify-between gap-4 rounded-xl bg-white dark:bg-[#2D1B22] p-4 shadow-sm cursor-pointer transition ${
        isSelected
          ? 'border-2 border-primary ring-4 ring-primary/10'
          : 'border border-pink-100 dark:border-pink-900/30'
      }`}
      onClick={onToggle}
    >
      <div className="flex flex-[2_2_0px] flex-col justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isSelected && (
              <span className="text-white text-[10px] font-bold uppercase tracking-wider bg-primary px-2 py-0.5 rounded">
                Выбрано
              </span>
            )}
            {service.category && (
              <p className="text-pink-500 dark:text-pink-400 text-xs font-semibold uppercase tracking-wide">
                {service.category}
              </p>
            )}
          </div>
          <p className="text-[#2D1B22] dark:text-white text-lg font-bold leading-tight">{service.name}</p>
          {service.description && (
            <p className="text-gray-500 dark:text-pink-200/60 text-sm font-normal leading-snug line-clamp-2">
              {service.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-gray-400 dark:text-pink-300/40">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span className="text-xs font-medium">{service.duration} мин</span>
            </div>
            <p className="text-primary text-xl font-extrabold">
              {typeof service.price === 'string' 
                ? parseFloat(service.price).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                : Number(service.price).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              } ₽
            </p>
          </div>
          <button
            onClick={handleInfoClick}
            className="flex size-8 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/20 text-primary hover:bg-pink-100 dark:hover:bg-pink-900/30 transition"
          >
            <span className="material-symbols-outlined text-lg">info</span>
          </button>
        </div>
      </div>
      {service.imageUrl && (
        <div
          className="w-28 h-28 bg-center bg-no-repeat bg-cover rounded-lg shrink-0"
          style={{ backgroundImage: `url("${service.imageUrl}")` }}
        />
      )}
    </div>
    </>
  );
}
