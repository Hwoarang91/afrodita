import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTelegram } from '../contexts/TelegramContext';

/**
 * Страница 404 - заглушка для неверных путей
 */
export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { webApp, hapticFeedback } = useTelegram();

  useEffect(() => {
    // Настройка MainButton для Telegram Web App
    if (webApp?.MainButton) {
      const mainButton = webApp.MainButton;
      mainButton.setText('На главную');
      mainButton.show();

      const handleMainButtonClick = () => {
        hapticFeedback.impactOccurred('medium');
        navigate('/');
      };

      mainButton.onClick(handleMainButtonClick);

      return () => {
        mainButton.offClick(handleMainButtonClick);
        mainButton.hide();
      };
    }
  }, [webApp, hapticFeedback, navigate]);

  const handleGoHome = () => {
    hapticFeedback.impactOccurred('medium');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-5 sm:p-8 text-center border border-border">
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🔍</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
          Страница не найдена
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
          Запрашиваемая страница <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code> не существует
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
          Возможно, страница была перемещена или удалена
        </p>
        <button
          onClick={handleGoHome}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition text-base sm:text-lg"
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}

