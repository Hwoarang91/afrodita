import axios from 'axios';

// API URL загружается из переменных окружения (корневой .env)
// Next.js автоматически подхватывает переменные с префиксом NEXT_PUBLIC_
// В браузере всегда используем относительный путь для работы через Nginx
// На сервере (SSR) используем полный URL или переменную окружения
const getApiUrl = (): string => {
  // Проверяем переменную окружения (доступна в браузере с префиксом NEXT_PUBLIC_)
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    // Если это полный URL (начинается с http), используем его
    if (apiUrl.startsWith('http')) {
      return apiUrl;
    }
    // Иначе это относительный путь
    return apiUrl;
  }
  
  // В браузере: если это localhost, используем полный URL к backend
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Если запущено на localhost, используем полный URL к backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api/v1';
    }
    // В production используем относительный путь (для работы через Nginx)
    return '/api/v1';
  }
  
  // На сервере (SSR) используем localhost или переменную окружения
  return process.env?.API_URL || 'http://localhost:3001/api/v1';
};

// Используем функцию для получения baseURL, чтобы она вызывалась динамически
export const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Переопределяем baseURL в interceptor для гарантии правильного URL
apiClient.interceptors.request.use((config) => {
  // Проверяем переменную окружения
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    config.baseURL = process.env.NEXT_PUBLIC_API_URL;
  } else if (typeof window !== 'undefined') {
    // В браузере: если это localhost, используем полный URL к backend
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      config.baseURL = 'http://localhost:3001/api/v1';
    } else {
      // В production используем относительный путь (для работы через Nginx)
      config.baseURL = '/api/v1';
    }
    
    // Добавляем токен авторизации
    // Проверяем в порядке приоритета: cookies -> sessionStorage -> localStorage
    // Cookies имеют приоритет, так как устанавливаются сервером
    let token = null;
    if (typeof window !== 'undefined') {
      console.log('🔍 API Request: Проверяем токен перед отправкой запроса', {
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        currentPath: window.location.pathname,
        currentURL: window.location.href,
        allCookies: document.cookie,
        localStorageToken: localStorage.getItem('admin-token'),
        sessionStorageToken: sessionStorage.getItem('admin-token'),
        justLoggedIn: sessionStorage.getItem('just-logged-in'),
      });

      // 1. Проверяем cookies (приоритет - установлено сервером)
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin-token='))
        ?.split('=')[1];
      
      if (cookieToken) {
        token = cookieToken;
        // Синхронизируем в sessionStorage и localStorage для клиентских компонентов
        sessionStorage.setItem('admin-token', cookieToken);
        localStorage.setItem('admin-token', cookieToken);
      } else {
        // 2. Fallback: проверяем sessionStorage
        token = sessionStorage.getItem('admin-token');
        if (token) {
          localStorage.setItem('admin-token', token);
          // Если токен есть в storage, но нет в cookies - устанавливаем в cookie для надежности
          document.cookie = `admin-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        } else {
          // 3. Fallback: проверяем localStorage
          token = localStorage.getItem('admin-token');
          if (token) {
            sessionStorage.setItem('admin-token', token);
            // Если токен есть в storage, но нет в cookies - устанавливаем в cookie для надежности
            document.cookie = `admin-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
          }
        }
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ API Request: Токен найден и добавлен в заголовок Authorization', {
        hasToken: !!token,
        tokenLength: token.length,
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        tokenPrefix: token.substring(0, 20) + '...',
        hasAuthHeader: !!config.headers.Authorization,
        fullAuthHeader: config.headers.Authorization,
        cookieToken: document.cookie.split('; ').find(row => row.startsWith('admin-token='))?.split('=')[1],
        localStorageToken: localStorage.getItem('admin-token'),
        sessionStorageToken: sessionStorage.getItem('admin-token'),
      });
    } else {
      console.error('❌ API Request: Токен НЕ найден ни в одном хранилище', {
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        hasCookies: document.cookie.length > 0,
        allCookies: document.cookie,
        cookieToken: document.cookie.split('; ').find(row => row.startsWith('admin-token='))?.split('=')[1],
        localStorageToken: localStorage.getItem('admin-token'),
        sessionStorageToken: sessionStorage.getItem('admin-token'),
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
      });
    }
    
    // Логирование только в development режиме
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        hasToken: !!token,
      });
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // Логируем только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  (error) => {
    const errorMessage = error?.response?.data?.message || error?.message || 'Произошла ошибка';
    const status = error.response?.status;
    
    // Логирование ошибок только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        message: errorMessage,
        status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
      });
    }
    
    if (typeof window !== 'undefined') {
      // Обработка 401 - неавторизован
      if (status === 401) {
        const currentPath = window.location.pathname;
        const currentUrl = window.location.href;
        const requestUrl = error.config?.url || '';
        
        // ВАЖНО: Проверяем URL запроса - если это /auth/login, то мы точно на странице логина
        // Это самый надежный способ определить, что ошибка произошла при попытке входа
        const isLoginRequest = requestUrl === '/auth/login' || requestUrl.includes('/auth/login');
        const isRegisterRequest = requestUrl === '/auth/register' || requestUrl.includes('/auth/register');
        const isCheckSetupRequest = requestUrl.includes('/auth/check-setup');
        
        // Проверяем текущий путь страницы (с учетом basePath и без него)
        const isLoginPage = 
          isLoginRequest ||  // Если это запрос логина - мы точно на странице логина
          currentUrl.includes('/admin/login') ||  // Проверка по полному URL (самый надежный)
          currentUrl.includes('/login') ||  // Проверка по URL без префикса
          currentPath === '/admin/login' ||  // Полный путь с basePath
          currentPath === '/login' ||  // Путь без basePath (если Next.js его удалил)
          currentPath.endsWith('/login');  // Любой путь, заканчивающийся на /login
          
        const isRegisterPage = 
          isRegisterRequest ||  // Если это запрос регистрации - мы точно на странице регистрации
          currentUrl.includes('/admin/register') ||  // Проверка по полному URL (самый надежный)
          currentUrl.includes('/register') ||  // Проверка по URL без префикса
          currentPath === '/admin/register' ||  // Полный путь с basePath
          currentPath === '/register' ||  // Путь без basePath
          currentPath.endsWith('/register');  // Любой путь, заканчивающийся на /register
        
        // Логирование для отладки (включаем в production для диагностики)
        console.log('401 Error - Path check:', {
          currentPath,
          currentUrl,
          requestUrl,
          isLoginRequest,
          isRegisterRequest,
          isCheckSetupRequest,
          isLoginPage,
          isRegisterPage,
          willRedirect: !isLoginPage && !isRegisterPage && !isCheckSetupRequest,
        });
        
        // Если это запрос логина или регистрации - очищаем токен и НЕ делаем редирект
        // Это нормальная ошибка авторизации, которую должна обработать страница
        // Но нужно очистить старый токен, чтобы избежать бесконечного редиректа
        if (isLoginRequest || isRegisterRequest) {
          console.log('401 при логине/регистрации - очищаем токен, не делаем редирект');
          // Очищаем токен, так как он невалидный
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
          document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
          return Promise.reject(error);
        }
        
        // Если это запрос check-setup и мы на странице логина/регистрации - очищаем токен
        // Это означает, что токен невалидный (пользователя нет в БД или токен истек)
        // Очищаем токен, чтобы избежать бесконечного редиректа
        if (isCheckSetupRequest && (isLoginPage || isRegisterPage)) {
          console.log('401 при check-setup на странице логина/регистрации - очищаем токен');
          // Очищаем токен, так как он невалидный
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
          document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
          return Promise.reject(error);
        }
        
        // Если пользователь НЕ на странице логина/регистрации - удаляем токен и редиректим
        // НО проверяем флаг just-logged-in и наличие токена в cookies
        if (!isLoginPage && !isRegisterPage) {
          // Проверяем флаг just-logged-in - если только что залогинились, не делаем редирект
          const cookieJustLoggedIn = document.cookie
            .split('; ')
            .find(row => row.startsWith('just-logged-in='))
            ?.split('=')[1];
          const sessionJustLoggedIn = sessionStorage.getItem('just-logged-in');
          const justLoggedIn = cookieJustLoggedIn === 'true' || sessionJustLoggedIn === 'true';
          
          // Проверяем наличие токена в cookies
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('admin-token='))
            ?.split('=')[1];
          
          // Если только что залогинились ИЛИ токен есть в cookies - НЕ делаем редирект
          // Это означает, что токен установлен, но возможно еще не валидирован на бэкенде
          // Или есть проблема с передачей токена в заголовке Authorization
          if (justLoggedIn || cookieToken) {
            console.log('401 после логина или токен есть в cookies - не делаем редирект, возможно проблема с передачей токена', {
              justLoggedIn,
              hasCookieToken: !!cookieToken,
              cookieTokenLength: cookieToken?.length,
            });
            // Не делаем редирект, просто возвращаем ошибку
            // Возможно, токен еще не успел синхронизироваться или не передается в заголовке
            // Пробуем повторно установить токен в заголовке для следующего запроса
            if (cookieToken && typeof window !== 'undefined') {
              // Синхронизируем токен из cookies в storage
              localStorage.setItem('admin-token', cookieToken);
              sessionStorage.setItem('admin-token', cookieToken);
              console.log('Токен синхронизирован из cookies в storage для следующего запроса');
            }
            return Promise.reject(error);
          }
          
          // Проверяем, не было ли уже редиректа недавно (защита от бесконечного цикла)
          const lastRedirectTime = sessionStorage.getItem('last-401-redirect-time');
          const now = Date.now();
          if (lastRedirectTime && (now - parseInt(lastRedirectTime)) < 5000) {
            console.log('401 редирект уже был недавно - пропускаем, чтобы избежать бесконечного цикла');
            return Promise.reject(error);
          }
          
          console.log('401 на другой странице, токена нет в cookies - делаем редирект на /login');
          // Сохраняем время редиректа
          sessionStorage.setItem('last-401-redirect-time', now.toString());
          
          // Удаляем токен только если мы НЕ на странице логина/регистрации
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
          sessionStorage.removeItem('admin-token');
          // Удаляем токен из cookies
          document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
          
          // Редиректим на логин (используем router для правильной работы с basePath)
          // Но так как мы в interceptor, используем window.location
          // basePath уже учтен в next.config.js, поэтому используем относительный путь
          window.location.href = '/login';
        } else {
          console.log('401 на странице логина/регистрации - не делаем редирект');
        }
        // Если пользователь на странице логина/регистрации - НЕ делаем НИЧЕГО
        // НЕ удаляем токен, НЕ делаем редирект - просто возвращаем ошибку
        // Позволяем странице обработать ошибку самостоятельно
        
        // Всегда возвращаем ошибку, чтобы страница логина могла её обработать
        return Promise.reject(error);
      }
      
      // Показываем toast для других ошибок (кроме 401, который уже обработан)
      if (status !== 401 && typeof window !== 'undefined' && window.showErrorToast) {
        let toastType: 'error' | 'warning' | 'info' = 'error';
        let message = errorMessage;
        
        if (status === 403) {
          toastType = 'warning';
          message = 'Доступ запрещен';
        } else if (status === 404) {
          toastType = 'info';
          message = 'Ресурс не найден';
        } else if (status === 500) {
          message = 'Ошибка сервера. Попробуйте позже';
        } else if (!error.response) {
          message = 'Ошибка сети. Проверьте подключение к интернету';
        }
        
        window.showErrorToast(message, toastType);
      }
    }
    
    return Promise.reject(error);
  },
);

