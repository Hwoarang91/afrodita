'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import { ExportButton } from '../components/ExportButton';
import { exportClients } from '@/lib/export';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Grid3x3, List, Search, X, Edit, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  bonusPoints: number;
  telegramId?: string;
  createdAt: string;
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useLocalStorage<string>('clients-search', '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce поиска на 500ms
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', phone: '' });
  const [editClient, setEditClient] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [viewMode, setViewMode] = useLocalStorage<'cards' | 'list'>('clients-view-mode', 'cards');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients', debouncedSearchQuery, page],
    queryFn: async () => {
      const { data } = await apiClient.get('/users', {
        params: {
          role: 'client',
          search: debouncedSearchQuery,
          page,
          limit,
        },
      });
      return data;
    },
  });

  const clients = useMemo(() => clientsData?.data || [], [clientsData?.data]);
  const totalPages = useMemo(() => clientsData?.totalPages || 1, [clientsData?.totalPages]);

  // Сбрасываем на первую страницу при изменении поиска (используем debounced значение)
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onMutate: async (id) => {
      const queryKey = ['clients', debouncedSearchQuery, page];
      await queryClient.cancelQueries({ queryKey });
      const previousClients = queryClient.getQueryData(queryKey);
      
      // Удаляем из списка сразу
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data?.filter((client: Client) => client.id !== id) || [],
          total: old.total ? old.total - 1 : 0,
        };
      });
      
      return { previousClients, queryKey };
    },
    onError: (error: any, id, context) => {
      if (context?.previousClients && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousClients);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: () => {
      toast.success('Клиент удален');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string }) => {
      const { data: result } = await apiClient.post('/users', {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'client',
      });
      return result;
    },
    onMutate: async (newClientData) => {
      const queryKey = ['clients', debouncedSearchQuery, page];
      await queryClient.cancelQueries({ queryKey });
      const previousClients = queryClient.getQueryData(queryKey);
      
      // Оптимистично добавляем нового клиента
      const optimisticClient: Client = {
        id: `temp-${Date.now()}`,
        firstName: newClientData.firstName,
        lastName: newClientData.lastName,
        phone: newClientData.phone,
        bonusPoints: 0,
        createdAt: new Date().toISOString(),
      };
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [optimisticClient, ...(old.data || [])],
          total: old.total ? old.total + 1 : 1,
        };
      });
      
      return { previousClients, queryKey };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousClients && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousClients);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: (data) => {
      setIsAddModalOpen(false);
      setNewClient({ firstName: '', lastName: '', phone: '' });
      toast.success('Клиент создан');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; firstName: string; lastName: string; phone: string; email?: string }) => {
      await apiClient.put(`/users/${data.id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email || undefined,
      });
    },
    onMutate: async (updatedData) => {
      const queryKey = ['clients', debouncedSearchQuery, page];
      await queryClient.cancelQueries({ queryKey });
      const previousClients = queryClient.getQueryData(queryKey);
      
      // Оптимистично обновляем клиента
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data?.map((client: Client) =>
            client.id === updatedData.id
              ? { ...client, ...updatedData }
              : client
          ) || [],
        };
      });
      
      return { previousClients, queryKey };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousClients && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousClients);
      }
      // Ошибка уже обработана в API interceptor
    },
    onSuccess: () => {
      setIsEditModalOpen(false);
      setEditingClient(null);
      setEditClient({ firstName: '', lastName: '', phone: '', email: '' });
      toast.success('Клиент обновлен');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const handleEditClick = useCallback((client: Client) => {
    setEditingClient(client);
    setEditClient({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      email: client.email || '',
    });
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((client: Client) => {
    setDeleteConfirm({ id: client.id, name: `${client.firstName} ${client.lastName}` });
  }, []);

  // Мемоизированный компонент карточки клиента
  const ClientCard = memo(({ client, onEdit, onDelete }: { client: Client; onEdit: (client: Client) => void; onDelete: (client: Client) => void }) => (
    <Card className="hover:shadow-lg transition-shadow relative">
      <CardContent className="p-6">
        <Link href={`/clients/${client.id}`} className="block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {client.firstName} {client.lastName}
            </h3>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold">
                {client.firstName[0]}
                {client.lastName?.[0]}
              </span>
            </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {client.phone && (
              <div>
                <span className="font-medium">Телефон:</span> {client.phone}
              </div>
            )}
            {client.email && (
              <div>
                <span className="font-medium">Email:</span> {client.email}
              </div>
            )}
            <div>
              <span className="font-medium">Бонусы:</span> {client.bonusPoints} баллов
            </div>
            {client.telegramId && (
              <div className="text-xs text-muted-foreground">Telegram ID: {client.telegramId}</div>
            )}
          </div>
        </Link>
        <div className="absolute bottom-2 right-2 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(client);
            }}
            title="Редактировать клиента"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(client);
            }}
            className="text-destructive hover:text-destructive"
            title="Удалить клиента"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  ));
  
  ClientCard.displayName = 'ClientCard';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const exportData = clients ? exportClients(clients) : [];

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-foreground">Клиенты</h1>
          <div className="flex gap-2 items-center">
            {/* Переключение вида */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('cards')}
                title="Карточки"
                className={cn(
                  "rounded-none border-0",
                  viewMode === 'cards' && 'bg-primary text-primary-foreground'
                )}
              >
                <Grid3x3 className="h-5 w-5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                title="Список"
                className={cn(
                  "rounded-none border-0",
                  viewMode === 'list' && 'bg-primary text-primary-foreground'
                )}
              >
                <List className="h-5 w-5" />
              </Button>
            </div>
            {clients && clients.length > 0 && (
              <ExportButton
                data={exportData}
                filename="clients"
                title="Клиенты"
                headers={exportData[0]}
              />
            )}
            <Button onClick={() => setIsAddModalOpen(true)}>
              + Добавить клиента
            </Button>
          </div>
        </div>
        <div className="relative w-full max-w-md">
          <Input
            type="text"
            placeholder="Поиск по имени, телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
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

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients?.map((client: Client) => (
            <ClientCard 
              key={client.id} 
              client={client} 
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Бонусы</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients?.map((client: Client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold text-sm">
                          {client.firstName[0]}
                          {client.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {client.firstName} {client.lastName}
                        </div>
                        {client.telegramId && (
                          <div className="text-xs text-muted-foreground">Telegram ID: {client.telegramId}</div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell>{client.email || '-'}</TableCell>
                  <TableCell>{client.bonusPoints} баллов</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleEditClick(client);
                        }}
                        title="Редактировать клиента"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteClick(client);
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Удалить клиента"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {(!clients || clients.length === 0) && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">Клиенты не найдены</div>
      )}

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
            Страница {page} из {totalPages} (Всего: {clientsData?.total || 0})
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

      {/* Модальное окно для добавления клиента */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить клиента</DialogTitle>
            <DialogDescription>
              Заполните информацию о новом клиенте
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newClient.firstName && newClient.lastName && newClient.phone) {
                createMutation.mutate(newClient);
              } else {
                toast.error('Заполните все обязательные поля');
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя *</Label>
              <Input
                id="firstName"
                type="text"
                value={newClient.firstName}
                onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия *</Label>
              <Input
                id="lastName"
                type="text"
                value={newClient.lastName}
                onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон *</Label>
              <Input
                id="phone"
                type="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewClient({ firstName: '', lastName: '', phone: '' });
                }}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Создание...' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Модальное окно для редактирования клиента */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать клиента</DialogTitle>
            <DialogDescription>
              Обновите информацию о клиенте
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editClient.firstName && editClient.lastName && editClient.phone) {
                  updateMutation.mutate({
                    id: editingClient.id,
                    firstName: editClient.firstName,
                    lastName: editClient.lastName,
                    phone: editClient.phone,
                    email: editClient.email,
                  });
                } else {
                  toast.error('Заполните все обязательные поля');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="editFirstName">Имя *</Label>
                <Input
                  id="editFirstName"
                  type="text"
                  value={editClient.firstName}
                  onChange={(e) => setEditClient({ ...editClient, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Фамилия *</Label>
                <Input
                  id="editLastName"
                  type="text"
                  value={editClient.lastName}
                  onChange={(e) => setEditClient({ ...editClient, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">Телефон *</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  value={editClient.phone}
                  onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editClient.email}
                  onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingClient(null);
                    setEditClient({ firstName: '', lastName: '', phone: '', email: '' });
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить клиента?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить клиента {deleteConfirm?.name}? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

