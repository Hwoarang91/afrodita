import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { appointmentsApi } from '../api/appointments';
import { servicesApi } from '../api/services';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AppointmentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const masterId = searchParams.get('masterId');
  const serviceId = searchParams.get('serviceId');
  const startTime = searchParams.get('startTime');

  const { data: service } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.getById(serviceId!),
    enabled: !!serviceId,
  });

  const { data: master } = useQuery({
    queryKey: ['master', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/masters/${masterId}`);
      return data;
    },
    enabled: !!masterId,
  });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      toast.success('Запись успешно создана!');
      navigate('/profile');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка создания записи');
    },
  });

  const handleConfirm = () => {
    if (masterId && serviceId && startTime) {
      createMutation.mutate({
        masterId,
        serviceId,
        startTime,
      });
    }
  };

  if (!service || !master) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Подтверждение записи</h1>
        <div className="space-y-4 mb-6">
          <div>
            <span className="text-gray-600">Услуга:</span>
            <p className="text-lg font-semibold">{service.name}</p>
          </div>
          <div>
            <span className="text-gray-600">Мастер:</span>
            <p className="text-lg font-semibold">{master.name}</p>
          </div>
          <div>
            <span className="text-gray-600">Дата и время:</span>
            <p className="text-lg font-semibold">
              {new Date(startTime!).toLocaleString('ru-RU')}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Стоимость:</span>
            <p className="text-2xl font-bold text-primary-600">{service.price} ₽</p>
          </div>
        </div>
        <button
          onClick={handleConfirm}
          disabled={createMutation.isPending}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
        >
          {createMutation.isPending ? 'Создание...' : 'Подтвердить запись'}
        </button>
      </div>
    </div>
  );
}

