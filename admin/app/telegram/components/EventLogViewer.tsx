'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Filter, Trash2, Download, AlertCircle, CheckCircle, Clock, Zap, Shield } from 'lucide-react';
import { TelegramEventLog } from '@/lib/hooks/useTelegramWebSocket';
import { cn } from '@/lib/utils';

interface EventLogViewerProps {
  events: TelegramEventLog[];
  onClear?: () => void;
  onExport?: () => void;
  className?: string;
}

/**
 * Компонент для просмотра MTProto событий в реальном времени
 */
export function EventLogViewer({
  events,
  onClear,
  onExport,
  className,
}: EventLogViewerProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к последнему событию
  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'connect':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'disconnect':
        return <X className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'invoke':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'flood-wait':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventBadge = (type: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; label: string }> = {
      connect: { variant: 'default', label: 'Подключение' },
      disconnect: { variant: 'secondary', label: 'Отключение' },
      error: { variant: 'destructive', label: 'Ошибка' },
      invoke: { variant: 'outline', label: 'Вызов' },
      'flood-wait': { variant: 'outline', label: 'FloodWait' },
    };

    const config = variants[type] || { variant: 'outline' as const, label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filteredEvents = events.filter((event) => {
    // Фильтр по типу
    if (filterType !== 'all' && event.type !== filterType) {
      return false;
    }

    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchableText = [
        event.type,
        event.sessionId,
        event.userId,
        event.data?.method,
        event.data?.error,
        event.data?.context,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }

    // Экспорт в JSON
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telegram-events-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            MTProto Event Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{events.length} событий</Badge>
            {onExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Экспорт
              </Button>
            )}
            {onClear && (
              <Button variant="outline" size="sm" onClick={onClear}>
                <Trash2 className="w-4 h-4 mr-2" />
                Очистить
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Фильтры */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Поиск</Label>
            <Input
              id="search"
              placeholder="Поиск по событиям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="w-48">
            <Label>Тип события</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="connect">Подключение</SelectItem>
                <SelectItem value="disconnect">Отключение</SelectItem>
                <SelectItem value="error">Ошибки</SelectItem>
                <SelectItem value="invoke">Вызовы</SelectItem>
                <SelectItem value="flood-wait">FloodWait</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Список событий */}
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет событий для отображения</p>
              {events.length > 0 && (
                <p className="text-xs mt-2">Попробуйте изменить фильтры</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-3 rounded-lg border text-sm',
                    event.type === 'error' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
                    event.type === 'flood-wait' && 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
                    event.type === 'connect' && 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
                    event.type === 'disconnect' && 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      {getEventIcon(event.type)}
                      {getEventBadge(event.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2 space-y-1 text-xs">
                    {event.sessionId && (
                      <p>
                        <span className="font-semibold">Session:</span>{' '}
                        <span className="font-mono">{event.sessionId.substring(0, 8)}...</span>
                      </p>
                    )}
                    {event.userId && (
                      <p>
                        <span className="font-semibold">User:</span> {event.userId}
                      </p>
                    )}
                    {event.data?.method && (
                      <p>
                        <span className="font-semibold">Method:</span>{' '}
                        <code className="bg-muted px-1 rounded">{event.data.method}</code>
                      </p>
                    )}
                    {event.data?.duration !== undefined && (
                      <p>
                        <span className="font-semibold">Duration:</span> {event.data.duration}ms
                      </p>
                    )}
                    {event.data?.waitTime !== undefined && (
                      <p className="text-yellow-600 dark:text-yellow-400">
                        <span className="font-semibold">Wait Time:</span> {event.data.waitTime}s
                      </p>
                    )}
                    {event.data?.error && (
                      <p className="text-red-600 dark:text-red-400">
                        <span className="font-semibold">Error:</span> {event.data.error}
                      </p>
                    )}
                    {event.data?.context && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold">Context:</span> {event.data.context}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
