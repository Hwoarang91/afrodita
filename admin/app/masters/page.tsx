'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { ExportButton } from '../components/ExportButton';
import { exportMasters } from '@/lib/export';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, ChevronLeft, ChevronRight, Edit, Trash2, Calendar, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Master {
  id: string;
  name: string;
  specialization: string;
  experience: number;
  rating: number;
  isActive: boolean;
  photoUrl?: string;
  education?: string;
  services?: Array<{ id: string; name: string }>;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  user: { name: string };
  createdAt: string;
}

export default function MastersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<Master | null>(null);
  const [searchQuery, setSearchQuery] = useLocalStorage<string>('masters-search', '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce поиска на 500ms
  const [filterActive, setFilterActive] = useLocalStorage<boolean | null>('masters-filter-active', null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const limit = 20;

  const { data: mastersData, isLoading } = useQuery({
    queryKey: ['masters', debouncedSearchQuery, filterActive, page],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters', {
        params: {
          search: debouncedSearchQuery || undefined,
          isActive: filterActive !== null ? filterActive : undefined,
          page,
          limit,
        },
      });
      return data;
    },
  });

  const masters = mastersData?.data || [];
  const totalPages = mastersData?.totalPages || 1;

  // Сбрасываем на первую страницу при изменении фильтров (используем debounced значение)
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, filterActive]);

  // Фильтрация теперь на стороне сервера
  const filteredMasters = masters;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/masters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast.success('Мастер успешно удален');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Не удалось удалить мастера';
      toast.error(errorMessage);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-16 rounded-full mb-4" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const exportData = filteredMasters && filteredMasters.length > 0 ? exportMasters(filteredMasters) : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Мастера</h1>
        <div className="flex gap-2">
          {filteredMasters && filteredMasters.length > 0 && (
            <ExportButton
              data={exportData}
              filename="masters"
              title="Мастера"
              headers={exportData[0]}
            />
          )}
          <Button
            onClick={() => {
              setEditingMaster(null);
              setIsModalOpen(true);
            }}
          >
            + Добавить мастера
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Поиск */}
          <div className="space-y-2">
            <Label>Поиск</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Имя или специализация..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </div>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Фильтр по активности */}
          <div className="space-y-2">
            <Label>Статус</Label>
            <select
              value={filterActive === null ? '' : filterActive ? 'active' : 'inactive'}
              onChange={(e) => {
                const value = e.target.value;
                setFilterActive(value === '' ? null : value === 'active');
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>
        </div>
        
        {/* Кнопка сброса фильтров */}
        {(searchQuery || filterActive !== null) && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterActive(null);
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMasters && filteredMasters.length > 0 ? (
          filteredMasters.map((master: Master) => (
          <Card key={master.id} className="hover:shadow-lg transition-all">
            <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                {master.photoUrl ? (
                  <img
                    src={master.photoUrl}
                    alt={master.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-semibold">
                    {master.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{master.name}</h3>
                  <p className="text-sm text-muted-foreground">{master.specialization}</p>
                </div>
              </div>
              {!master.isActive && (
                <Badge variant="secondary">Неактивен</Badge>
              )}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">Опыт:</span>
                <span className="ml-2 font-semibold">{master.experience} лет</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">Рейтинг:</span>
                <span className="ml-2 font-semibold flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  {Number(master.rating || 0).toFixed(1)}
                </span>
              </div>
            </div>
            <MasterReviews masterId={master.id} />
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingMaster(master);
                    setIsModalOpen(true);
                  }}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Редактировать
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteMutation.mutate(master.id);
                  }}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить
                </Button>
              </div>
              <Button
                variant="outline"
                asChild
                className="w-full"
              >
                <Link href={`/masters/${master.id}/schedule`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Расписание
                </Link>
              </Button>
            </div>
            </CardContent>
          </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            {searchQuery || filterActive !== null
              ? 'Мастера не найдены по заданным фильтрам'
              : 'Нет мастеров'}
          </div>
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page} из {totalPages} (Всего: {mastersData?.total || 0})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
          >
            Вперед
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <MasterModal
        key={editingMaster?.id || 'new'} // Пересоздаем компонент при изменении мастера
        master={editingMaster}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMaster(null);
        }}
      />
    </div>
  );
}

function MasterReviews({ masterId }: { masterId: string }) {
  const { data: reviews } = useQuery({
    queryKey: ['reviews', masterId],
    queryFn: async () => {
      const { data } = await apiClient.get('/reviews', {
        params: { masterId, status: 'APPROVED' },
      });
      return data.slice(0, 3); // Показываем только последние 3 отзыва
    },
    enabled: !!masterId,
  });

  if (!reviews || reviews.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm font-semibold mb-2">Последние отзывы:</p>
      <div className="space-y-2">
        {reviews.map((review: Review) => (
          <div key={review.id} className="text-sm">
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < review.rating
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'text-muted-foreground'
                  }`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                {review.user.name}
              </span>
            </div>
            {review.comment && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MasterModal({ master, open, onClose }: { master: Master | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  
  // Загружаем полные данные мастера при редактировании
  const { data: masterData } = useQuery({
    queryKey: ['master', master?.id],
    queryFn: async () => {
      if (master?.id) {
        const { data } = await apiClient.get(`/masters/${master.id}`);
        return data;
      }
      return null;
    },
    enabled: !!master?.id,
  });

  const currentMaster = masterData || master;

  const [formData, setFormData] = useState({
    name: currentMaster?.name || '',
    specialization: currentMaster?.specialization || '',
    experience: currentMaster?.experience || 0,
    rating: currentMaster?.rating || 5.0,
    isActive: currentMaster?.isActive ?? true,
    education: currentMaster?.education || '',
    serviceIds: currentMaster?.services?.map((s: any) => s.id) || [],
    photoUrl: currentMaster?.photoUrl || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentMaster?.photoUrl || null);

  // Обновляем formData при загрузке данных мастера или при создании нового
  useEffect(() => {
    if (currentMaster) {
      // Преобразуем specialties (массив) в specialization (строка) для отображения
      const specialization = currentMaster.specialization 
        || (currentMaster.specialties && currentMaster.specialties.length > 0 
          ? currentMaster.specialties[0] 
          : '');
      
      setFormData({
        name: currentMaster.name || '',
        specialization: specialization,
        experience: currentMaster.experience || 0,
        rating: currentMaster.rating || 5.0,
        isActive: currentMaster.isActive ?? true,
        education: currentMaster.education || '',
        serviceIds: currentMaster.services?.map((s: any) => s.id) || [],
        photoUrl: currentMaster.photoUrl || '',
      });
      setAvatarPreview(currentMaster.photoUrl || null);
      setAvatarFile(null);
    } else if (!master) {
      // Сброс при создании нового мастера
      setFormData({
        name: '',
        specialization: '',
        experience: 0,
        rating: 5.0,
        isActive: true,
        education: '',
        serviceIds: [],
        photoUrl: '',
      });
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }, [currentMaster, master]);

  // Загружаем список услуг для выбора
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', {
        params: {
          page: 1,
          limit: 1000, // Большой лимит для получения всех услуг
        },
      });
      // API теперь возвращает объект с пагинацией { data: [], total, page, limit, totalPages }
      return Array.isArray(data) ? data : (data?.data || []);
    },
  });
  
  const services = Array.isArray(servicesData) ? servicesData : (servicesData?.data || []);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        // Если есть файл аватарки, загружаем его
        let photoUrl = data.photoUrl;
        const fileToProcess = data.avatarFile || avatarFile;
        if (fileToProcess) {
          // Сжимаем изображение перед отправкой
          photoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Максимальные размеры
                const maxWidth = 800;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;
                
                // Вычисляем новые размеры с сохранением пропорций
                if (width > height) {
                  if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                  }
                } else {
                  if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                  }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Рисуем изображение на canvas
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Конвертируем в base64 с качеством 0.8
                resolve(canvas.toDataURL('image/jpeg', 0.8));
              };
              img.onerror = reject;
              img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(fileToProcess);
          });
        }

        const dataToSend = {
          name: data.name,
          specialization: data.specialization,
          experience: data.experience,
          rating: data.rating,
          isActive: data.isActive,
          education: data.education,
          serviceIds: data.serviceIds,
          photoUrl,
        };

        // Определяем ID мастера для редактирования
        // Используем master?.id, так как он доступен сразу при открытии модального окна
        const masterId = master?.id;
        if (masterId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Редактирование мастера:', masterId, dataToSend);
          }
          const response = await apiClient.put(`/masters/${masterId}`, dataToSend);
          return response.data;
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('Создание нового мастера:', dataToSend);
          }
          const response = await apiClient.post('/masters', dataToSend);
          return response.data;
        }
      } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Ошибка при сохранении мастера:', error);
          console.error('Детали ошибки:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            config: error.config,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    },
    onError: (error: any) => {
      let errorMessage = 'Не удалось сохранить мастера';
      
      if (error.response) {
        // Сервер ответил с ошибкой
        errorMessage = error.response.data?.message || 
                      error.response.data?.error || 
                      `Ошибка сервера: ${error.response.status}`;
      } else if (error.request) {
        // Запрос был отправлен, но ответа не получено
        errorMessage = 'Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.';
      } else {
        // Ошибка при настройке запроса
        errorMessage = error.message || 'Неизвестная ошибка';
      }
      
      // Ошибка уже обработана в API interceptor
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {master ? 'Редактировать мастера' : 'Добавить мастера'}
          </DialogTitle>
          <DialogDescription>
            {master ? 'Обновите информацию о мастере' : 'Заполните информацию о новом мастере'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Валидация и подготовка данных
            // Бэкенд принимает specialization как строку и преобразует в specialties
            const dataToSend = {
              name: formData.name.trim(),
              specialization: formData.specialization.trim(), // Бэкенд преобразует это в specialties
              experience: Number(formData.experience) || 0,
              rating: Number(formData.rating) || 5.0,
              isActive: formData.isActive !== undefined ? formData.isActive : true,
              education: formData.education.trim(),
              serviceIds: formData.serviceIds,
              photoUrl: avatarPreview || formData.photoUrl, // Используем preview или существующий URL
            };
            
            // Проверка обязательных полей
            if (!dataToSend.name) {
              toast.warning('Пожалуйста, введите имя мастера');
              return;
            }
            
            if (!dataToSend.specialization) {
              toast.warning('Пожалуйста, введите специализацию');
              return;
            }
            
            console.log('Отправка данных мастера:', dataToSend);
            mutation.mutate({ ...dataToSend, avatarFile });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="masterName">Имя</Label>
            <Input
              id="masterName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Аватарка</Label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  Нет фото
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setAvatarPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Рекомендуемый размер: 200x200px</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialization">Специализация</Label>
            <Input
              id="specialization"
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="education">Образование</Label>
            <Textarea
              id="education"
              value={formData.education}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              rows={2}
              placeholder="Например: Высшее медицинское образование, сертификат по массажу"
            />
          </div>
          <div className="space-y-2">
            <Label>Услуги</Label>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-muted/50">
              {services?.map((service: any) => (
                <label key={service.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={formData.serviceIds.includes(service.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          serviceIds: [...formData.serviceIds, service.id],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          serviceIds: formData.serviceIds.filter((id: string) => id !== service.id),
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{service.name}</span>
                </label>
              ))}
              {(!services || services.length === 0) && (
                <p className="text-sm text-muted-foreground">Нет доступных услуг</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="experience">Опыт (лет)</Label>
              <Input
                id="experience"
                type="number"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Рейтинг</Label>
              <Input
                id="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isActive" className="cursor-pointer">Активен</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                master ? 'Сохранить' : 'Создать'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

