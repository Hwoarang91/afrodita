import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { ServiceCardSkeleton } from '../../shared/components/SkeletonLoader';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import EmptyState from '../../shared/components/EmptyState';
import StepIndicator from '../../shared/components/StepIndicator';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { useTelegram } from '../../contexts/TelegramContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

interface Master {
  id: string;
  name: string;
  bio?: string;
  specialties?: string[]; // Массив специализаций
  photoUrl?: string;
  rating: number;
  experience: number;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  user?: { name: string };
  createdAt?: string;
}

export default function MasterSelection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  const serviceId = searchParams.get('serviceId');
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today'>('all');
  const [anyMaster, setAnyMaster] = useState(false);
  const [reviewsModalMasterId, setReviewsModalMasterId] = useState<string | null>(null);
  const [clickedReview, setClickedReview] = useState<Review | null>(null);

  // Настройка BackButton для Telegram Web App
  useTelegramBackButton();

  // Без serviceId возврат к списку услуг (избегаем ошибок и бессмысленного экрана)
  useEffect(() => {
    if (!serviceId || serviceId === '') {
      navigate('/services', { replace: true });
    }
  }, [serviceId, navigate]);

  const { data: mastersData, isLoading } = useQuery({
    queryKey: ['masters'],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters');
      return Array.isArray(data) ? data : (data?.data || []);
    },
  });

  const masters: Master[] = Array.isArray(mastersData) ? mastersData : (mastersData?.data || []) || [];

  // Просмотр отзывов доступен всем; оставить отзыв можно только после посещения услуги (проверяется при создании отзыва на бэкенде)

  const { data: reviewsList, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', reviewsModalMasterId],
    queryFn: async () => {
      if (!reviewsModalMasterId) return [];
      const { data } = await apiClient.get('/reviews', {
        params: { masterId: reviewsModalMasterId, status: 'approved', limit: 50 },
      });
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    enabled: !!reviewsModalMasterId,
  });
  const reviews = (reviewsList ?? []) as Review[];

  // Пока редирект в /services не сработал — не рендерить контент
  if (!serviceId || serviceId === '') {
    return <LoadingSpinner />;
  }

  const handleMasterSelect = (masterId: string) => {
    setSelectedMaster(masterId);
    hapticFeedback.selectionChanged();
  };

  const handleNext = (masterId?: string) => {
    const masterToUse = masterId ?? selectedMaster ?? (anyMaster && masters.length > 0 ? masters[0].id : null);
    if (masterToUse && serviceId) {
      hapticFeedback.impactOccurred('medium');
      navigate(`/calendar?masterId=${masterToUse}&serviceId=${serviceId}`);
    }
  };

  const openReviewsModal = (masterId: string) => {
    hapticFeedback.selectionChanged();
    setReviewsModalMasterId(masterId);
  };

  // Звезды рейтинга с поддержкой половинки (например 4.5 из 5)
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const remainder = rating % 1;
    const showHalfStar = remainder >= 0.25 && remainder < 0.75;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <span key={i} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1", color: '#fbbf24' }}>
            star
          </span>
        );
      } else if (i === fullStars && showHalfStar) {
        stars.push(
          <span key={i} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1", color: '#fbbf24' }}>
            star_half
          </span>
        );
      } else {
        stars.push(
          <span key={i} className="material-symbols-outlined text-sm text-pink-100 dark:text-pink-900/40">
            star
          </span>
        );
      }
    }
    return stars;
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-[#2D1B22] dark:text-pink-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center p-4 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-[#2D1B22] shadow-sm"
          >
            <span className="material-symbols-outlined text-[#2D1B22] dark:text-pink-100">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-[#2D1B22] dark:text-white text-lg font-bold leading-tight tracking-tight">Выберите мастера</h2>
          </div>
          <div className="size-10"></div>
        </div>
        <StepIndicator currentStep={2} />
      </header>

      <main className="pb-24">
        {/* Filter Tabs */}
        <div className="flex px-4 py-4">
          <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-pink-50 dark:bg-pink-950/20 p-1.5">
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-xl px-2 transition-all ${
              filter === 'all' 
                ? 'bg-white dark:bg-pink-900/40 shadow-sm text-primary dark:text-pink-100' 
                : 'text-[#8b5e66] dark:text-pink-400'
            }`}>
              <span className="truncate text-sm font-semibold">Все</span>
              <input
                checked={filter === 'all'}
                onChange={() => {
                  setFilter('all');
                  hapticFeedback.selectionChanged();
                }}
                className="invisible w-0"
                name="filter"
                type="radio"
                value="all"
              />
            </label>
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-xl px-2 transition-all ${
              filter === 'today' 
                ? 'bg-white dark:bg-pink-900/40 shadow-sm text-primary dark:text-pink-100' 
                : 'text-[#8b5e66] dark:text-pink-400'
            }`}>
              <span className="truncate text-sm font-semibold">На сегодня</span>
              <input
                checked={filter === 'today'}
                onChange={() => {
                  setFilter('today');
                  hapticFeedback.selectionChanged();
                }}
                className="invisible w-0"
                name="filter"
                type="radio"
                value="today"
              />
            </label>
          </div>
        </div>

        {/* Any Master Checkbox */}
        <div className="px-4 mb-4">
          <label className="flex items-center gap-x-3 py-4 px-5 rounded-2xl border border-pink-100 dark:border-pink-900/30 bg-pink-50/30 dark:bg-pink-950/10 shadow-sm cursor-pointer">
            <input
              type="checkbox"
              checked={anyMaster}
              onChange={(e) => {
                setAnyMaster(e.target.checked);
                hapticFeedback.selectionChanged();
              }}
              className="h-5 w-5 rounded-lg border-pink-200 dark:border-pink-800 border-2 bg-transparent text-primary checked:bg-primary checked:border-primary focus:ring-0 focus:ring-offset-0 focus:outline-none transition-colors"
              style={{
                appearance: 'none',
                backgroundImage: anyMaster ? "url('data:image/svg+xml,%3csvg viewBox=%270 0 16 16%27 fill=%27white%27 xmlns=%27http://www.w3.org/2000/svg%27%3e%3cpath d=%27M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z%27/%3e%3c/svg%3e')" : 'none',
                backgroundSize: '100% 100%'
              }}
            />
            <p className="text-[#4a3438] dark:text-pink-100 text-sm font-semibold">Любой свободный мастер</p>
          </label>
        </div>

        {/* Masters List */}
        <div className="flex flex-col gap-4 px-4">
          {isLoading ? (
            <div className="space-y-4">
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
            </div>
          ) : masters && masters.length > 0 ? (
            masters.map((master: Master) => {
              const rating = Number((master as any).rating) || 0;
              const experience = Number((master as any).experience) || 0;
              return (
              <div
                key={master.id}
                role="button"
                tabIndex={0}
                onClick={() => handleMasterSelect(master.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleMasterSelect(master.id)}
                className={`flex flex-col gap-4 rounded-2xl bg-white dark:bg-[#25171a] p-4 shadow-sm border-2 transition-colors cursor-pointer ${
                  selectedMaster === master.id ? 'border-primary dark:border-primary' : 'border-pink-50 dark:border-pink-900/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-[2_2_0px] flex-col gap-1">
                    <div className="flex flex-col">
                      <p className="text-primary dark:text-primary text-[10px] font-bold uppercase tracking-widest mb-0.5">
                        Опыт {experience} {experience === 1 ? 'год' : experience < 5 ? 'года' : 'лет'}
                      </p>
                      <p className="text-[#4a3438] dark:text-pink-50 text-lg font-bold leading-tight">{master.name}</p>
                      <p className="text-[#8b5e66] dark:text-pink-300 text-xs font-medium mt-0.5">
                        {master.specialties && master.specialties.length > 0 
                          ? master.specialties.join(', ') 
                          : master.bio || 'Массажист'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {renderStars(rating)}
                      <span className="text-[#4a3438] dark:text-pink-50 text-xs font-bold ml-1">{rating.toFixed(1)}</span>
                      <button
                        type="button"
                        className="text-primary dark:text-primary text-[11px] font-bold underline ml-2 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReviewsModal(master.id);
                        }}
                        title="Отзывы"
                      >
                        Отзывы
                      </button>
                    </div>
                  </div>
                  {master.photoUrl && (
                    <div 
                      className="size-20 bg-center bg-no-repeat bg-cover rounded-full border-2 border-pink-100 dark:border-pink-900/50 flex-shrink-0"
                      style={{ backgroundImage: `url("${master.photoUrl}")` }}
                    />
                  )}
                </div>
              </div>
            ); })
          ) : (
            <EmptyState
              icon="👤"
              title="Мастера не найдены"
              description="В данный момент нет доступных мастеров. Попробуйте позже."
            />
          )}
        </div>
      </main>

      {/* Фиксированная кнопка «Выбрать» — одна на всех мастеров */}
      <div className="fixed bottom-0 left-0 right-0 z-20 max-w-[430px] mx-auto p-4 pb-6 bg-white/90 dark:bg-[#1f1214]/90 backdrop-blur-md border-t border-pink-100 dark:border-pink-900/30">
        <button
          type="button"
          disabled={!selectedMaster && !anyMaster}
          onClick={() => handleNext()}
          className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-pink-200/50 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          Выбрать
        </button>
      </div>

      {/* Модальное окно отзывов — просмотр доступен всем */}
      <Dialog open={!!reviewsModalMasterId} onOpenChange={(open) => !open && setReviewsModalMasterId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Отзывы</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-3 pr-2">
            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-pulse text-pink-400">Загрузка отзывов…</div>
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-[#8b5e66] dark:text-pink-400">Пока нет отзывов.</p>
            ) : (
              reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => {
                    setClickedReview(review);
                    hapticFeedback?.selectionChanged?.();
                  }}
                  className="w-full text-left p-3 rounded-xl border border-pink-100 dark:border-pink-900/30 hover:bg-pink-50/50 dark:hover:bg-pink-950/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {renderStars(Number(review.rating) || 0)}
                    <span className="text-xs font-semibold text-[#4a3438] dark:text-pink-100">
                      {review.user?.name ?? '—'}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-xs text-[#8b5e66] dark:text-pink-400 line-clamp-2">{review.comment}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Детальный просмотр отзыва (кликабельный отзыв) */}
      <Dialog open={!!clickedReview} onOpenChange={(open) => !open && setClickedReview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отзыв</DialogTitle>
          </DialogHeader>
          {clickedReview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {renderStars(Number(clickedReview.rating) || 0)}
                <span className="text-sm text-[#8b5e66] dark:text-pink-400">{clickedReview.user?.name ?? '—'}</span>
              </div>
              {clickedReview.comment ? (
                <p className="text-sm text-[#4a3438] dark:text-pink-100 whitespace-pre-wrap">{clickedReview.comment}</p>
              ) : (
                <p className="text-sm text-[#8b5e66] dark:text-pink-400">Без комментария</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
