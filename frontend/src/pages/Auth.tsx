import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../contexts/TelegramContext';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

export default function Auth() {
  const navigate = useNavigate();
  const { webApp, user: tgUser, isReady } = useTelegram();
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
      toast.success('Успешная авторизация!');
      navigate('/services');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка авторизации');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold text-foreground mb-4">Авторизация</h1>
        <p className="text-muted-foreground mb-8">Пожалуйста, подождите...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    </div>
  );
}

