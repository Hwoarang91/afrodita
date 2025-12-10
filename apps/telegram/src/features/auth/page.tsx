import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../../contexts/TelegramContext';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../shared/api/client';
import toast from 'react-hot-toast';

export default function Auth() {
  const navigate = useNavigate();
  const { webApp, user: tgUser, isReady, hapticFeedback } = useTelegram();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    if (isReady && tgUser && webApp) {
      handleTelegramAuth();
    }
  }, [isReady, tgUser, webApp]);

  const handleTelegramAuth = async () => {
    if (!webApp || !tgUser) return;
    
    try {
      const authData = {
        id: tgUser.id.toString(),
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        username: tgUser.username,
        auth_date: Math.floor(Date.now() / 1000),
        hash: webApp.initData,
      };

      const response = await apiClient.post('/auth/telegram', authData);
      const { user, accessToken, refreshToken } = response.data;

      setAuth(user, accessToken, refreshToken);
      hapticFeedback.notificationOccurred('success');
      toast.success('Успешная авторизация!');
      navigate('/services');
    } catch (error: any) {
      hapticFeedback.notificationOccurred('error');
      toast.error(error.response?.data?.message || 'Ошибка авторизации');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-5 sm:p-8 text-center border border-border">
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🔐</div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Авторизация</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">Пожалуйста, подождите...</p>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}

