import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ServiceCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

interface Master {
  id: string;
  name: string;
  bio?: string;
  specialties?: string[]; // Массив специализаций
  photoUrl?: string;
  rating: number;
  experience: number;
}

export default function MasterSelection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const serviceId = searchParams.get('serviceId');
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null);

  const { data: mastersData, isLoading } = useQuery({
    queryKey: ['masters'],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters');
      // API теперь возвращает объект с пагинацией { data: [], total, page, limit, totalPages }
      return Array.isArray(data) ? data : (data?.data || []);
    },
  });

  const masters = Array.isArray(mastersData) ? mastersData : (mastersData?.data || []);

  const handleNext = () => {
    if (selectedMaster && serviceId) {
      navigate(`/calendar?masterId=${selectedMaster}&serviceId=${serviceId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">Выберите мастера</h1>
        {isLoading ? (
          <div className="space-y-4">
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
          </div>
        ) : masters && masters.length > 0 ? (
          <>
            <div className="space-y-4">
              {masters.map((master: Master) => (
                <div
                  key={master.id}
                  onClick={() => setSelectedMaster(master.id)}
                  className={`bg-card rounded-lg shadow-md p-6 cursor-pointer transition border border-border ${
                    selectedMaster === master.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {master.photoUrl && (
                      <img
                        src={master.photoUrl}
                        alt={master.name}
                        className="w-20 h-20 rounded-full object-cover border border-border"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground">{master.name}</h3>
                      {/* Отображаем specialties (из админки) или bio (для обратной совместимости) */}
                      {master.specialties && master.specialties.length > 0 ? (
                        <p className="text-muted-foreground mt-1">{master.specialties.join(', ')}</p>
                      ) : master.bio ? (
                        <p className="text-muted-foreground mt-1">{master.bio}</p>
                      ) : null}
                      <div className="flex gap-4 mt-2">
                        <span className="text-sm text-muted-foreground">⭐ {master.rating}</span>
                        <span className="text-sm text-muted-foreground">💼 {master.experience} лет</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {selectedMaster && (
              <button
                onClick={handleNext}
                className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition"
              >
                Выбрать время
              </button>
            )}
          </>
        ) : (
          <EmptyState
            icon="👤"
            title="Мастера не найдены"
            description="В данный момент нет доступных мастеров. Попробуйте позже."
          />
        )}
      </div>
    </div>
  );
}

