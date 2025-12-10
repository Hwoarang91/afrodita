import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTelegram } from '../contexts/TelegramContext';

/**
 * Хук для управления BackButton в Telegram Web App
 * Автоматически показывает/скрывает кнопку в зависимости от истории навигации
 */
export const useTelegramBackButton = (showOnPaths?: string[]) => {
  const { webApp } = useTelegram();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!webApp?.BackButton) return;

    const backButton = webApp.BackButton;
    
    // Определяем, нужно ли показывать кнопку
    const shouldShow = showOnPaths 
      ? showOnPaths.includes(location.pathname)
      : location.pathname !== '/' && location.pathname !== '/auth';

    if (shouldShow) {
      backButton.show();
      
      const handleBack = () => {
        navigate(-1);
      };
      
      backButton.onClick(handleBack);
      
      return () => {
        backButton.offClick(handleBack);
        backButton.hide();
      };
    } else {
      backButton.hide();
    }
  }, [webApp, location.pathname, navigate, showOnPaths]);
};

