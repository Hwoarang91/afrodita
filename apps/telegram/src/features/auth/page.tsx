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
      // Парсим initData из Telegram WebApp
      // initData имеет формат: "query_id=...&user=...&auth_date=...&hash=..."
      // ВАЖНО: для валидации hash нужно использовать оригинальные параметры из initData,
      // а не распарсенные данные, так как Telegram формирует hash на основе оригинальных параметров
      const parseInitData = (initData: string) => {
        // Проверяем, что initData не является уже объектом
        if (typeof initData === 'object') {
          console.warn('initData is already an object, using as is');
          return initData;
        }
        
        const params = new URLSearchParams(initData);
        const result: any = {};
        
        // Извлекаем hash отдельно - это критически важно!
        const hashValue = params.get('hash');
        if (hashValue) {
          result.hash = hashValue;
        } else {
          console.error('Hash not found in initData!');
          result.hash = '';
        }
        
        // ВАЖНО: для валидации hash нужно передать оригинальные параметры из initData
        // Telegram формирует hash на основе параметров initData, а не распарсенных данных
        // Поэтому передаем все параметры кроме hash, photo_url и signature
        
        // Извлекаем auth_date
        const authDateStr = params.get('auth_date');
        if (authDateStr) {
          result.auth_date = parseInt(authDateStr, 10);
        } else {
          result.auth_date = Math.floor(Date.now() / 1000);
        }
        
        // Извлекаем query_id (если есть)
        const queryId = params.get('query_id');
        if (queryId) {
          result.query_id = queryId;
        }
        
        // Извлекаем user как строку (не парсим!) - это важно для валидации
        const userStr = params.get('user');
        if (userStr) {
          // Сохраняем оригинальную строку user для валидации
          result.user = userStr;
          
          // Также парсим для удобства использования данных
          try {
            const user = JSON.parse(decodeURIComponent(userStr));
            result.id = user.id?.toString() || '';
            result.first_name = user.first_name || '';
            result.last_name = user.last_name || '';
            result.username = user.username || '';
            result.photo_url = user.photo_url || '';
          } catch (e) {
            console.error('Error parsing user data:', e);
          }
        }
        
        // НЕ добавляем signature и другие параметры - только те, что нужны для валидации
        // Telegram требует строго определенный набор полей для проверки hash
        // signature (Bot API 8.0+) НЕ включается в data_check_string
        
        return result;
      };

      // Логируем доступные данные для диагностики
      console.log('Telegram WebApp data:', {
        hasInitData: !!webApp.initData,
        initDataLength: webApp.initData?.length || 0,
        initDataPreview: webApp.initData ? webApp.initData.substring(0, 100) + '...' : 'empty',
        hasInitDataUnsafe: !!webApp.initDataUnsafe,
        tgUser: tgUser ? {
          id: tgUser.id,
          first_name: tgUser.first_name,
          username: tgUser.username,
        } : null,
      });

      // Если initData есть, парсим его
      let authData: any;
      if (webApp.initData) {
        console.log('Parsing initData:', webApp.initData);
        authData = parseInitData(webApp.initData);
        console.log('Parsed authData:', { ...authData, hash: authData.hash ? `${authData.hash.substring(0, 20)}...` : 'empty' });
        
        // Если в initData нет данных пользователя, используем tgUser как fallback
        if (!authData.id && tgUser) {
          console.log('Using tgUser as fallback for missing id in initData');
          authData.id = tgUser.id.toString();
          authData.first_name = tgUser.first_name || '';
          authData.last_name = tgUser.last_name || '';
          authData.username = tgUser.username || '';
        }
      } else {
        // Fallback: используем данные из tgUser и создаем временный hash
        // ВНИМАНИЕ: это не будет работать для валидации, но для тестирования можно использовать
        authData = {
          id: tgUser.id.toString(),
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          auth_date: Math.floor(Date.now() / 1000),
          hash: '', // Без initData hash будет пустым, валидация не пройдет
        };
      }

      // Валидация данных перед отправкой
      if (!authData.hash || authData.hash.length < 32) {
        console.error('Invalid hash in authData:', authData);
        throw new Error('Invalid Telegram authentication data: hash is missing or invalid');
      }
      
      if (!authData.id) {
        console.error('Missing user id in authData:', authData);
        throw new Error('Invalid Telegram authentication data: user id is missing');
      }
      
      // Исключаем photo_url из данных перед отправкой
      // photo_url не включается в data_check_string по документации Telegram
      const { photo_url, ...dataToSend } = authData;
      
      console.log('Sending Telegram auth data:', {
        id: dataToSend.id,
        first_name: dataToSend.first_name,
        last_name: dataToSend.last_name,
        username: dataToSend.username,
        auth_date: dataToSend.auth_date,
        hash: dataToSend.hash ? `${dataToSend.hash.substring(0, 20)}...` : 'empty',
        hashLength: dataToSend.hash?.length || 0,
      });

      const response = await apiClient.post('/auth/telegram', dataToSend);
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

