import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../api/appointments';
import { servicesApi } from '../api/services';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AppointmentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    onMutate: async (newAppointment) => {
      // Оптимистично обновляем список записей
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const previousAppointments = queryClient.getQueryData(['appointments']);
      
      // Добавляем новую запись в список
      queryClient.setQueryData(['appointments'], (old: any) => {
        if (!old) return old;
        const optimisticAppointment = {
          id: `temp-${Date.now()}`,
          ...newAppointment,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        return Array.isArray(old) ? [...old, optimisticAppointment] : old;
      });
      
      return { previousAppointments };
    },
    onError: (error: any, variables, context) => {
      // Откатываем изменения при ошибке
      if (context?.previousAppointments) {
        queryClient.setQueryData(['appointments'], context.previousAppointments);
      }
      toast.error(error.response?.data?.message || 'Ошибка создания записи');
    },
    onSuccess: () => {
      toast.success('Запись успешно создана!');
      navigate('/profile');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-md p-6 border border-border">
        <h1 className="text-3xl font-bold text-foreground mb-6">Подтверждение записи</h1>
        <div className="space-y-4 mb-6">
          <div>
            <span className="text-muted-foreground">Услуга:</span>
            <p className="text-lg font-semibold text-foreground">{service.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Мастер:</span>
            <p className="text-lg font-semibold text-foreground">{master.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Дата и время:</span>
            <p className="text-lg font-semibold text-foreground">
              {new Date(startTime!).toLocaleString('ru-RU')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Стоимость:</span>
            <p className="text-2xl font-bold text-primary">{service.price} ₽</p>
          </div>
        </div>
        <button
          onClick={handleConfirm}
          disabled={createMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
        >
          {createMutation.isPending ? 'Создание...' : 'Подтвердить запись'}
        </button>
      </div>
    </div>
  );
}

