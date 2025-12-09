import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Компонент для редиректа админ-панели на правильный путь
 * Редиректит /login → /admin/login и /register → /admin/register
 */
export default function AdminRedirect() {
  const location = useLocation();

  useEffect(() => {
    // Редиректим на правильный путь админ-панели
    if (location.pathname === '/login') {
      window.location.href = '/admin/login';
    } else if (location.pathname === '/register') {
      window.location.href = '/admin/register';
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-5 sm:p-8 text-center border border-border">
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🔄</div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Перенаправление...</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
          Вы будете перенаправлены на страницу администратора
        </p>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}

