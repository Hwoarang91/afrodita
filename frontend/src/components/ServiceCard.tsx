import { Service } from '../api/services';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

export default function ServiceCard({ service, onClick }: ServiceCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition border border-border"
    >
      {service.imageUrl && (
        <img
          src={service.imageUrl}
          alt={service.name}
          className="w-full h-40 sm:h-48 object-cover rounded-lg mb-3 sm:mb-4"
        />
      )}
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">{service.name}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">{service.description}</p>
      <div className="flex justify-between items-center">
        <span className="text-xl sm:text-2xl font-bold text-primary">{service.price} ₽</span>
        <span className="text-xs sm:text-sm text-muted-foreground">{service.duration} мин</span>
      </div>
    </div>
  );
}

