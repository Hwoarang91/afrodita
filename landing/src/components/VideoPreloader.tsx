import { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface VideoPreloaderProps {
  onVideoEnd: () => void;
  videoPath?: string;
}

const VideoPreloader = ({ onVideoEnd, videoPath = '/video.mp4' }: VideoPreloaderProps) => {
  const [hasEnded, setHasEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Ждем определения типа устройства
    if (isMobile === undefined) {
      return;
    }

    // Показываем прелоадер только на мобильных устройствах
    if (!isMobile) {
      onVideoEnd();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Устанавливаем громкость на 70% (0.7)
    video.volume = 0.7;

    // Обработка окончания видео
    const handleEnded = () => {
      setHasEnded(true);
      // Небольшая задержка перед показом контента
      setTimeout(() => {
        onVideoEnd();
      }, 300);
    };

    // Обработка ошибок загрузки видео
    const handleError = () => {
      console.warn('Ошибка загрузки видео, показываем контент');
      onVideoEnd();
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Автоматически начинаем воспроизведение
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Автовоспроизведение заблокировано:', error);
        // Если автовоспроизведение заблокировано, показываем контент
        onVideoEnd();
      });
    }

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [isMobile, onVideoEnd, videoPath]);

  // Не показываем прелоадер на десктопе или пока не определился тип устройства
  if (!isMobile || isMobile === undefined) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-background transition-opacity duration-300 ${
        hasEnded ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={false}
        autoPlay
        preload="auto"
      >
        <source src={videoPath} type="video/mp4" />
        Ваш браузер не поддерживает видео.
      </video>
    </div>
  );
};

export default VideoPreloader;

