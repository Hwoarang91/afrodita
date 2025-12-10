import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: any;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: any;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: any;
  MainButton: any;
  HapticFeedback: any;
  CloudStorage: any;
  BiometricManager: any;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (eventType: string, eventHandler: (event?: any) => void) => void;
  offEvent: (eventType: string, eventHandler: (event?: any) => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: any) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: any, callback?: (id: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: any, callback?: (data: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean) => void) => void;
}

interface TelegramContextType {
  webApp: TelegramWebApp | null;
  user: any | null;
  isReady: boolean;
  hapticFeedback: {
    impactOccurred: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  isReady: false,
  hapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {},
  },
});

export const useTelegram = () => useContext(TelegramContext);

// Хелпер для применения themeParams к CSS переменным
const applyThemeParams = (themeParams: any) => {
  if (!themeParams) return;

  const root = document.documentElement;
  
  // Применяем цвета из themeParams к CSS переменным Telegram
  if (themeParams.bg_color) {
    root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
  }
  if (themeParams.text_color) {
    root.style.setProperty('--tg-theme-text-color', themeParams.text_color);
  }
  if (themeParams.hint_color) {
    root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
  }
  if (themeParams.link_color) {
    root.style.setProperty('--tg-theme-link-color', themeParams.link_color);
  }
  if (themeParams.button_color) {
    root.style.setProperty('--tg-theme-button-color', themeParams.button_color);
  }
  if (themeParams.button_text_color) {
    root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
  }
  if (themeParams.secondary_bg_color) {
    root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
  }
  if (themeParams.header_bg_color) {
    root.style.setProperty('--tg-theme-header-bg-color', themeParams.header_bg_color);
  }
  if (themeParams.accent_text_color) {
    root.style.setProperty('--tg-theme-accent-text-color', themeParams.accent_text_color);
  }
  if (themeParams.section_bg_color) {
    root.style.setProperty('--tg-theme-section-bg-color', themeParams.section_bg_color);
  }
  if (themeParams.destructive_text_color) {
    root.style.setProperty('--tg-theme-destructive-text-color', themeParams.destructive_text_color);
  }
};

// Функция для применения темы (светлая/темная)
const applyColorScheme = (colorScheme: 'light' | 'dark') => {
  const root = document.documentElement;
  if (colorScheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const TelegramProvider = ({ children }: { children: ReactNode }) => {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Хелперы для HapticFeedback
  const hapticFeedback = {
    impactOccurred: useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(style);
      }
    }, []),
    notificationOccurred: useCallback((type: 'error' | 'success' | 'warning') => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    }, []),
    selectionChanged: useCallback(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }
    }, []),
  };

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      // Инициализация
      tg.ready();
      
      // Расширение viewport для максимального использования экрана
      tg.expand();
      
      // Применение themeParams
      if (tg.themeParams) {
        applyThemeParams(tg.themeParams);
      }
      
      // Применение цветовой схемы
      if (tg.colorScheme) {
        applyColorScheme(tg.colorScheme);
      }
      
      // Настройка headerColor и backgroundColor из themeParams
      // Используем try-catch, чтобы не ломать приложение, если методы недоступны
      try {
        if (tg.themeParams?.header_bg_color) {
          tg.setHeaderColor(tg.themeParams.header_bg_color);
        }
        if (tg.themeParams?.bg_color) {
          tg.setBackgroundColor(tg.themeParams.bg_color);
        }
      } catch (error) {
        // Игнорируем ошибки при установке цветов (могут быть в некоторых версиях Telegram)
        if (process.env.NODE_ENV === 'development') {
          console.warn('Не удалось установить цвета Telegram Web App:', error);
        }
      }
      
      // Обработка изменения темы
      const handleThemeChanged = () => {
        if (tg.themeParams) {
          applyThemeParams(tg.themeParams);
        }
        if (tg.colorScheme) {
          applyColorScheme(tg.colorScheme);
        }
        try {
          if (tg.themeParams?.header_bg_color) {
            tg.setHeaderColor(tg.themeParams.header_bg_color);
          }
          if (tg.themeParams?.bg_color) {
            tg.setBackgroundColor(tg.themeParams.bg_color);
          }
        } catch (error) {
          // Игнорируем ошибки при установке цветов
          if (process.env.NODE_ENV === 'development') {
            console.warn('Не удалось установить цвета Telegram Web App:', error);
          }
        }
      };
      
      // Обработка изменения viewport
      const handleViewportChanged = (event: any) => {
        // Можно использовать для адаптации интерфейса
        console.log('Viewport changed:', {
          isStateStable: event?.isStateStable,
          viewportHeight: tg.viewportHeight,
          viewportStableHeight: tg.viewportStableHeight,
        });
      };
      
      tg.onEvent('themeChanged', handleThemeChanged);
      tg.onEvent('viewportChanged', handleViewportChanged);
      
      setWebApp(tg);
      setUser(tg.initDataUnsafe?.user || null);
      setIsReady(true);
      
      // Cleanup
      return () => {
        tg.offEvent('themeChanged', handleThemeChanged);
        tg.offEvent('viewportChanged', handleViewportChanged);
      };
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ webApp, user, isReady, hapticFeedback }}>
      {children}
    </TelegramContext.Provider>
  );
};

