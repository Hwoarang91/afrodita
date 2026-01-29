'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Edit, Trash2, Check, X, Star, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  status: string;
  moderationComment?: string;
  createdAt: string;
  user?: { id: string; firstName?: string; lastName?: string; name?: string };
  master?: { id: string; name: string };
  service?: { id: string; name: string };
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [masterIdFilter, setMasterIdFilter] = useState<string>('');
  const [serviceIdFilter, setServiceIdFilter] = useState<string>('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: '' });
  const [moderateModalOpen, setModerateModalOpen] = useState(false);
  const [moderateReview, setModerateReview] = useState<Review | null>(null);
  const [moderateStatus, setModerateStatus] = useState<'approved' | 'rejected'>('approved');
  const [moderationComment, setModerationComment] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Review | null>(null);
  const limit = 20;

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['reviews', page, statusFilter, masterIdFilter, serviceIdFilter],
    queryFn: async () => {
      const { data } = await apiClient.get('/reviews', {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
          masterId: masterIdFilter || undefined,
          serviceId: serviceIdFilter || undefined,
        },
      });
      return data;
    },
  });

  const { data: mastersData } = useQuery({
    queryKey: ['masters-list'],
    queryFn: async () => {
      const { data } = await apiClient.get('/masters', { params: { limit: 200 } });
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services-list'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services', { params: { limit: 500 } });
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      return list.filter((s: { isCategory?: boolean }) => !s.isCategory);
    },
  });

  const reviews = reviewsData?.data ?? [];
  const totalPages = reviewsData?.totalPages ?? 1;
  const masters = Array.isArray(mastersData) ? mastersData : (mastersData?.data ?? []);
  const services = servicesData ?? [];

  useEffect(() => {
    setPage(1);
  }, [statusFilter, masterIdFilter, serviceIdFilter]);

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: string; comment?: string }) => {
      await apiClient.post(`/reviews/${id}/moderate`, { status, moderationComment: comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setModerateModalOpen(false);
      setModerateReview(null);
      setModerationComment('');
      toast.success('Статус отзыва обновлён');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка модерации');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rating, comment }: { id: string; rating: number; comment?: string }) => {
      await apiClient.patch(`/reviews/${id}`, { rating, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setEditModalOpen(false);
      setEditingReview(null);
      toast.success('Отзыв обновлён');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка сохранения');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setDeleteConfirm(null);
      toast.success('Отзыв удалён');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка удаления');
    },
  });

  const openEdit = (review: Review) => {
    setEditingReview(review);
    setEditForm({ rating: review.rating, comment: review.comment ?? '' });
    setEditModalOpen(true);
  };

  const openModerate = (review: Review, status: 'approved' | 'rejected') => {
    setModerateReview(review);
    setModerateStatus(status);
    setModerationComment('');
    setModerateModalOpen(true);
  };

  const userName = (r: Review) => {
    const u = r.user;
    if (!u) return '—';
    return (u as { name?: string }).name ?? [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
  };

  const statusBadge = (status: string) => {
    const v = status?.toLowerCase();
    if (v === 'approved') return <Badge className="bg-green-600">Одобрен</Badge>;
    if (v === 'rejected') return <Badge variant="destructive">Отклонён</Badge>;
    return <Badge variant="secondary">На модерации</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Card className="p-4">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Отзывы</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Статус</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ml-2 border border-input rounded-md px-3 py-2 bg-background text-sm"
              >
                <option value="">Все</option>
                <option value="pending">На модерации</option>
                <option value="approved">Одобрены</option>
                <option value="rejected">Отклонены</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Мастер</Label>
              <select
                value={masterIdFilter}
                onChange={(e) => setMasterIdFilter(e.target.value)}
                className="ml-2 border border-input rounded-md px-3 py-2 bg-background text-sm min-w-[160px]"
              >
                <option value="">Все</option>
                {masters.map((m: { id: string; name: string }) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Услуга</Label>
              <select
                value={serviceIdFilter}
                onChange={(e) => setServiceIdFilter(e.target.value)}
                className="ml-2 border border-input rounded-md px-3 py-2 bg-background text-sm min-w-[180px]"
              >
                <option value="">Все</option>
                {services.map((s: { id: string; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Услуга</TableHead>
                  <TableHead>Мастер</TableHead>
                  <TableHead>Оценка</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Нет отзывов по выбранным фильтрам
                    </TableCell>
                  </TableRow>
                ) : (
                  reviews.map((review: Review) => (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium">{userName(review)}</TableCell>
                      <TableCell>{(review.service as { name?: string })?.name ?? '—'}</TableCell>
                      <TableCell>{(review.master as { name?: string })?.name ?? '—'}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-0.5">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          {review.rating}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={review.comment || ''}>
                        {review.comment || '—'}
                      </TableCell>
                      <TableCell>{statusBadge(review.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(review.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {review.status?.toLowerCase() === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-600 hover:bg-green-50"
                                onClick={() => openModerate(review, 'approved')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                                onClick={() => openModerate(review, 'rejected')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(review)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(review)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Редактирование отзыва */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать отзыв</DialogTitle>
            <DialogDescription>Измените оценку или комментарий. После сохранения пересчитается рейтинг мастера.</DialogDescription>
          </DialogHeader>
          {editingReview && (
            <div className="space-y-4">
              <div>
                <Label>Оценка (1–5)</Label>
                <select
                  value={editForm.rating}
                  onChange={(e) => setEditForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Комментарий</Label>
                <Textarea
                  value={editForm.comment}
                  onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                  className="mt-1 min-h-[100px]"
                  placeholder="Текст отзыва"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Отмена</Button>
            <Button
              onClick={() => editingReview && updateMutation.mutate({ id: editingReview.id, rating: editForm.rating, comment: editForm.comment || undefined })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модерация */}
      <Dialog open={moderateModalOpen} onOpenChange={setModerateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderateStatus === 'approved' ? 'Одобрить отзыв' : 'Отклонить отзыв'}</DialogTitle>
            <DialogDescription>
              {moderateStatus === 'approved'
                ? 'Отзыв будет опубликован. Клиенту могут быть начислены бонусы за отзыв (если включено в настройках).'
                : 'Укажите причину отклонения (необязательно).'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Комментарий модератора</Label>
            <Textarea
              value={moderationComment}
              onChange={(e) => setModerationComment(e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder={moderateStatus === 'rejected' ? 'Причина отклонения' : 'По желанию'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerateModalOpen(false)}>Отмена</Button>
            <Button
              variant={moderateStatus === 'rejected' ? 'destructive' : 'default'}
              onClick={() => moderateReview && moderateMutation.mutate({ id: moderateReview.id, status: moderateStatus, comment: moderationComment || undefined })}
              disabled={moderateMutation.isPending}
            >
              {moderateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : moderateStatus === 'approved' ? 'Одобрить' : 'Отклонить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить отзыв?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить. Рейтинг мастера будет пересчитан.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Отмена</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
