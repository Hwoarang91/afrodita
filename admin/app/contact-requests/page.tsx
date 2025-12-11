'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Check, Eye, Phone, User, MessageSquare, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ContactRequest {
  id: string;
  name: string;
  phone: string;
  message?: string;
  comment?: string;
  isRead: boolean;
  isProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ContactRequestsPage() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const limit = 20;

  useEffect(() => {
    loadRequests();
  }, [page]);

  useEffect(() => {
    if (selectedRequest) {
      setComment(selectedRequest.comment || '');
    }
  }, [selectedRequest]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/contact-requests', {
        params: { page, limit },
      });
      setRequests(response.data.data);
      setTotal(response.data.total);
      setSelectedIds(new Set()); // Сбрасываем выделение при загрузке новой страницы
    } catch (error: any) {
      console.error('Ошибка при загрузке заявок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map(r => r.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('Выберите заявки для удаления');
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить ${selectedIds.size} заявок?`)) {
      return;
    }

    try {
      await apiClient.post('/contact-requests/bulk-delete', {
        ids: Array.from(selectedIds),
      });
      await loadRequests();
    } catch (error: any) {
      console.error('Ошибка при удалении заявок:', error);
      alert('Ошибка при удалении заявок');
    }
  };

  const handleUpdateStatus = async (id: string, field: 'isRead' | 'isProcessed', value: boolean) => {
    try {
      await apiClient.patch(`/contact-requests/${id}`, {
        [field]: value,
      });
      await loadRequests();
    } catch (error: any) {
      console.error('Ошибка при обновлении заявки:', error);
    }
  };

  const handleSaveComment = async () => {
    if (!selectedRequest) return;

    setIsSaving(true);
    try {
      await apiClient.patch(`/contact-requests/${selectedRequest.id}`, {
        comment: comment,
      });
      await loadRequests();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Ошибка при сохранении комментария:', error);
      alert('Ошибка при сохранении комментария');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
      return;
    }
    try {
      await apiClient.delete(`/contact-requests/${id}`);
      await loadRequests();
    } catch (error: any) {
      console.error('Ошибка при удалении заявки:', error);
    }
  };

  const handleViewDetails = (request: ContactRequest) => {
    setSelectedRequest(request);
    setIsDialogOpen(true);
    if (!request.isRead) {
      handleUpdateStatus(request.id, 'isRead', true);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const allSelected = requests.length > 0 && selectedIds.size === requests.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < requests.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Заявки обратной связи</h1>
          <p className="text-muted-foreground mt-2">
            Управление заявками, оставленными через форму "Свяжитесь со мной" на лендинге
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить выбранные ({selectedIds.size})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Список заявок</CardTitle>
              <CardDescription>
                Всего заявок: {total}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Заявок пока нет
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Выделить все"
                      />
                    </TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Сообщение</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(request.id)}
                          onCheckedChange={() => handleSelectOne(request.id)}
                          aria-label={`Выделить заявку ${request.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{request.name}</TableCell>
                      <TableCell>{request.phone}</TableCell>
                      <TableCell>
                        {request.message ? (
                          <span className="truncate max-w-xs block">
                            {request.message}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!request.isRead && (
                            <Badge variant="default">Новое</Badge>
                          )}
                          {request.isProcessed && (
                            <Badge variant="secondary">Обработано</Badge>
                          )}
                          {request.comment && (
                            <Badge variant="outline">Есть комментарий</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(request)}
                            title="Просмотр и обработка"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(request.id)}
                            title="Удалить"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Назад
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Страница {page} из {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Вперед
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Обработка заявки</DialogTitle>
            <DialogDescription>
              Просмотр и обработка заявки обратной связи
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Имя</p>
                    <p className="font-medium">{selectedRequest.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Телефон</p>
                    <p className="font-medium">{selectedRequest.phone}</p>
                  </div>
                </div>
              </div>

              {selectedRequest.message && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Сообщение клиента</p>
                    <p className="whitespace-pre-wrap bg-muted p-3 rounded-md">{selectedRequest.message}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Дата создания</p>
                  <p className="font-medium">
                    {format(new Date(selectedRequest.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label>Статус заявки</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRequest.isRead}
                        onCheckedChange={(checked) => 
                          handleUpdateStatus(selectedRequest.id, 'isRead', checked as boolean)
                        }
                      />
                      <Label className="font-normal">Прочитано</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRequest.isProcessed}
                        onCheckedChange={(checked) => 
                          handleUpdateStatus(selectedRequest.id, 'isProcessed', checked as boolean)
                        }
                      />
                      <Label className="font-normal">Обработано</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="comment">Комментарий администратора</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Оставьте комментарий к заявке..."
                    className="mt-2 min-h-24"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSaveComment}
                  disabled={isSaving}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Закрыть
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDelete(selectedRequest.id);
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
