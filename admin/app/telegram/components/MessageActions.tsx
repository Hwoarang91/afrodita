'use client';

import { useState } from 'react';
import { Copy, Forward, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface MessageActionsProps {
  messageId: number;
  chatId: string;
  onForward?: (messageId: number, chatId: string) => void;
  onDelete?: (messageId: number, chatId: string) => void;
  className?: string;
}

/**
 * Компонент для быстрых действий с сообщением
 * - Копировать ID сообщения
 * - Переслать сообщение
 * - Удалить сообщение
 */
export function MessageActions({
  messageId,
  chatId,
  onForward,
  onDelete,
  className,
}: MessageActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(messageId.toString());
      toast.success('ID сообщения скопирован в буфер обмена');
      setShowMenu(false);
    } catch (error) {
      toast.error('Не удалось скопировать ID сообщения');
    }
  };

  const handleForward = () => {
    if (onForward) {
      onForward(messageId, chatId);
    }
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
        onDelete(messageId, chatId);
      }
    }
    setShowMenu(false);
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        onBlur={() => {
          // Закрываем меню при потере фокуса (с небольшой задержкой для клика по пунктам меню)
          setTimeout(() => setShowMenu(false), 200);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {showMenu && (
        <>
          {/* Overlay для закрытия меню при клике вне его */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          {/* Меню действий */}
          <div className="absolute right-0 top-8 z-20 w-48 bg-popover rounded-lg shadow-lg border border-border">
            <button
              onClick={handleCopyId}
              className="w-full text-left px-4 py-2 hover:bg-accent flex items-center gap-2 text-sm"
            >
              <Copy className="w-4 h-4" />
              Копировать ID
            </button>
            {onForward && (
              <button
                onClick={handleForward}
                className="w-full text-left px-4 py-2 hover:bg-accent flex items-center gap-2 text-sm"
              >
                <Forward className="w-4 h-4" />
                Переслать
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-full text-left px-4 py-2 hover:bg-destructive/10 text-destructive flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
