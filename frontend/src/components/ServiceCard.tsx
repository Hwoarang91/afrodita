import { Service } from '../api/services';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

export default function ServiceCard({ service, onClick }: ServiceCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition"
    >
      {service.imageUrl && (
        <img
          src={service.imageUrl}
          alt={service.name}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
      <p className="text-gray-600 mb-4 line-clamp-2">{service.description}</p>
      <div className="flex justify-between items-center">
        <span className="text-2xl font-bold text-primary-600">{service.price} ₽</span>
        <span className="text-gray-500">{service.duration} мин</span>
      </div>
    </div>
  );
}

