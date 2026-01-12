'use client';

import { useState, useRef, useEffect } from 'react';
import { Image, Video, File, Link, MapPin, User, ExternalLink, Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface MediaData {
  type: 'photo' | 'video' | 'audio' | 'document' | 'image' | 'webpage' | 'geo' | 'contact' | 'unknown';
  // Photo
  photoId?: string;
  accessHash?: string;
  dcId?: number;
  sizes?: Array<{
    type: string;
    width?: number;
    height?: number;
    size?: number;
    location?: {
      dcId: number;
      volumeId: string;
      localId: number;
      secret: string;
    } | null;
  }>;
  largestSize?: {
    width?: number;
    height?: number;
    size?: number;
  } | null;
  // Document
  documentId?: string;
  mimeType?: string;
  size?: string;
  date?: number;
  video?: {
    duration?: number;
    width?: number;
    height?: number;
    supportsStreaming?: boolean;
  };
  audio?: {
    duration?: number;
    performer?: string;
    title?: string;
  };
  fileName?: string;
  // Webpage
  url?: string;
  displayUrl?: string;
  siteName?: string;
  title?: string;
  description?: string;
  // Geo
  lat?: number;
  long?: number;
  // Contact
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  // Unknown
  raw?: any;
}

interface MediaPreviewProps {
  media: MediaData | null;
  className?: string;
  compact?: boolean;
}

/**
 * Компонент для отображения превью медиа с lazy loading и модальным окном
 */
export function MediaPreview({ media, className, compact = false }: MediaPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Lazy loading: загружаем изображение только когда оно видимо
  useEffect(() => {
    if (!media || media.type !== 'photo' || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' },
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [media]);

  if (!media) {
    return null;
  }

  // Генерация URL для фото (нужно будет реализовать endpoint для получения файлов)
  const getPhotoUrl = (size?: { location?: { dcId: number; volumeId: string; localId: number; secret: string } | null }) => {
    // TODO: Реализовать endpoint для получения файлов через Telegram API
    // Пока возвращаем placeholder
    if (size?.location) {
      // В будущем: `/api/v1/telegram/user/file?dcId=${size.location.dcId}&volumeId=${size.location.volumeId}&localId=${size.location.localId}&secret=${size.location.secret}`
      return null;
    }
    return null;
  };

  // Форматирование размера файла
  const formatFileSize = (bytes: string | number | undefined): string => {
    if (!bytes) return 'Неизвестно';
    const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(numBytes)) return 'Неизвестно';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = numBytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Форматирование длительности
  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Обработка фото
  if (media.type === 'photo') {
    const photoUrl = getPhotoUrl(media.largestSize);
    const hasUrl = !!photoUrl;

    return (
      <>
        <div
          className={cn(
            'relative group cursor-pointer overflow-hidden rounded-lg border border-border bg-muted',
            compact ? 'w-24 h-24' : 'w-full max-w-md',
            className,
          )}
          onClick={() => setIsModalOpen(true)}
        >
          {!isLoaded || !hasUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
          ) : (
            <>
              <img
                ref={imgRef}
                src={photoUrl || undefined}
                alt="Photo preview"
                className={cn(
                  'w-full h-full object-cover transition-opacity duration-300',
                  isLoaded && !imageError ? 'opacity-100' : 'opacity-0',
                )}
                onError={() => setImageError(true)}
                loading="lazy"
              />
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Image className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          )}
          {media.largestSize && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {media.largestSize.width}×{media.largestSize.height}
            </div>
          )}
        </div>

        {/* Модальное окно для просмотра фото в полном размере */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Просмотр фото</DialogTitle>
            </DialogHeader>
            <div className="p-6 flex items-center justify-center bg-black/5 dark:bg-black/20">
              {hasUrl ? (
                <img
                  src={photoUrl || undefined}
                  alt="Full size photo"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <div className="text-center py-12">
                  <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Превью фото недоступно. Endpoint для получения файлов еще не реализован.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Обработка видео
  if (media.type === 'video') {
    return (
      <div
        className={cn(
          'relative group rounded-lg border border-border bg-muted p-4',
          compact ? 'w-48' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate">Видео</span>
            </div>
            {media.video && (
              <div className="text-xs text-muted-foreground space-y-1">
                {media.video.duration && (
                  <div>Длительность: {formatDuration(media.video.duration)}</div>
                )}
                {media.video.width && media.video.height && (
                  <div>
                    Разрешение: {media.video.width}×{media.video.height}
                  </div>
                )}
                {media.size && <div>Размер: {formatFileSize(media.size)}</div>}
              </div>
            )}
            {media.fileName && (
              <div className="text-xs text-muted-foreground truncate mt-1">
                {media.fileName}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Обработка аудио
  if (media.type === 'audio') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted p-4',
          compact ? 'w-48' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <File className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <File className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate">Аудио</span>
            </div>
            {media.audio && (
              <div className="text-xs text-muted-foreground space-y-1">
                {media.audio.title && (
                  <div className="font-medium text-foreground">{media.audio.title}</div>
                )}
                {media.audio.performer && (
                  <div>Исполнитель: {media.audio.performer}</div>
                )}
                {media.audio.duration && (
                  <div>Длительность: {formatDuration(media.audio.duration)}</div>
                )}
              </div>
            )}
            {media.size && (
              <div className="text-xs text-muted-foreground mt-1">
                Размер: {formatFileSize(media.size)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Обработка документа
  if (media.type === 'document') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted p-4',
          compact ? 'w-48' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <File className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <File className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate">Документ</span>
            </div>
            {media.fileName && (
              <div className="text-xs text-foreground truncate mb-1">{media.fileName}</div>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              {media.mimeType && <div>Тип: {media.mimeType}</div>}
              {media.size && <div>Размер: {formatFileSize(media.size)}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Обработка веб-страницы
  if (media.type === 'webpage') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted p-4 hover:bg-muted/80 transition-colors',
          compact ? 'w-64' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Link className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {media.siteName && (
              <div className="text-xs text-muted-foreground mb-1">{media.siteName}</div>
            )}
            {media.title && (
              <div className="text-sm font-medium text-foreground mb-1 line-clamp-2">
                {media.title}
              </div>
            )}
            {media.description && (
              <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {media.description}
              </div>
            )}
            {media.url && (
              <a
                href={media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {media.displayUrl || media.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Обработка геолокации
  if (media.type === 'geo') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted p-4',
          compact ? 'w-48' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">Геолокация</div>
            {media.lat !== undefined && media.long !== undefined && (
              <a
                href={`https://www.google.com/maps?q=${media.lat},${media.long}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {media.lat.toFixed(6)}, {media.long.toFixed(6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Обработка контакта
  if (media.type === 'contact') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted p-4',
          compact ? 'w-48' : 'w-full max-w-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">
              {media.firstName} {media.lastName}
            </div>
            {media.phoneNumber && (
              <div className="text-xs text-muted-foreground">{media.phoneNumber}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Неизвестный тип медиа
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted p-4',
        compact ? 'w-48' : 'w-full max-w-md',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center">
          <File className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-muted-foreground">Медиа</div>
          <div className="text-xs text-muted-foreground">Тип: {media.type}</div>
        </div>
      </div>
    </div>
  );
}
