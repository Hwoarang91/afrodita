import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesApi } from '../api/services';
import { ServiceCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: service, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-md p-6 border border-border">
          <ServiceCardSkeleton />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon="❌"
            title="Услуга не найдена"
            description="Запрашиваемая услуга не существует или была удалена."
            actionLabel="Вернуться к услугам"
            onAction={() => navigate('/services')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-md p-6 border border-border">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-primary hover:text-primary/80"
        >
          ← Назад
        </button>
        {service.imageUrl && (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-64 object-cover rounded-lg mb-6 border border-border"
          />
        )}
        <h1 className="text-3xl font-bold text-foreground mb-4">{service.name}</h1>
        <p className="text-muted-foreground mb-6">{service.description}</p>
        <div className="flex justify-between items-center mb-6">
          <div>
            <span className="text-3xl font-bold text-primary">{service.price} ₽</span>
          </div>
          <div className="text-muted-foreground">
            <span className="text-lg">{service.duration} минут</span>
          </div>
        </div>
        <button
          onClick={() => navigate(`/masters?serviceId=${service.id}`)}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          Выбрать мастера
        </button>
      </div>
    </div>
  );
}

