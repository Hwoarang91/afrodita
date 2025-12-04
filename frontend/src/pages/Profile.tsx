import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { appointmentsApi } from '../api/appointments';
import { AppointmentCardSkeleton, ProfileSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentsApi.getAll('confirmed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(id, 'Отменено пользователем'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Запись отменена');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Ошибка при отмене записи');
    },
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Профиль</h1>
          <div className="space-y-2">
            <p className="text-gray-600">
              <span className="font-semibold">Имя:</span> {user?.firstName} {user?.lastName}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">Бонусы:</span> {user?.bonusPoints || 0} баллов
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Ближайшие записи</h2>
            <button
              onClick={() => navigate('/services')}
              className="text-primary-600 hover:text-primary-700 font-semibold"
            >
              + Новая запись
            </button>
          </div>
          {appointments && appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((apt: any) => (
                <div
                  key={apt.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{apt.service?.name}</h3>
                      <p className="text-gray-600">{apt.master?.name}</p>
                      <p className="text-gray-500 text-sm">
                        {format(new Date(apt.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                      </p>
                      <p className="text-primary-600 font-semibold mt-1">{apt.price} ₽</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => navigate(`/reschedule/${apt.id}`)}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 px-4 rounded-lg font-semibold hover:bg-blue-100 transition text-sm"
                    >
                      🔄 Перенести
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Отменить запись?')) {
                          cancelMutation.mutate(apt.id);
                        }
                      }}
                      className="flex-1 bg-red-50 text-red-600 py-2 px-4 rounded-lg font-semibold hover:bg-red-100 transition text-sm"
                    >
                      ❌ Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📅"
              title="Нет предстоящих записей"
              description="У вас пока нет записей. Запишитесь на услугу прямо сейчас!"
              actionLabel="Записаться"
              onAction={() => navigate('/services')}
            />
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/history')}
            className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            История
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Уведомления
          </button>
        </div>
      </div>
    </div>
  );
}

