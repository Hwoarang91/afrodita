'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'client' | 'admin' | 'master';
  bonusPoints: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  csrfToken: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshToken: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    csrfToken: null,
  });

  // Получение CSRF токена
  const getCsrfToken = async (): Promise<string> => {
    try {
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.csrfToken;
      }
      throw new Error('Failed to get CSRF token');
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      throw error;
    }
  };

  // Логин
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const csrfToken = await getCsrfToken();

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      setAuthState({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        csrfToken,
      });

      console.log('Login successful:', data.user.email);
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      console.error('Login error:', error);
      throw error;
    }
  };

  // Логаут
  const logout = async (): Promise<void> => {
    try {
      const csrfToken = authState.csrfToken || await getCsrfToken();

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        csrfToken: null,
      });

      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Даже при ошибке очищаем локальное состояние
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        csrfToken: null,
      });
    }
  };

  // Логаут со всех устройств
  const logoutAllDevices = async (): Promise<void> => {
    try {
      const csrfToken = authState.csrfToken || await getCsrfToken();

      await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        csrfToken: null,
      });

      console.log('Logout from all devices successful');
    } catch (error) {
      console.error('Logout from all devices error:', error);
      // Даже при ошибке очищаем локальное состояние
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        csrfToken: null,
      });
    }
  };

  // Обновление токена
  const refreshToken = async (): Promise<void> => {
    try {
      const csrfToken = authState.csrfToken || await getCsrfToken();

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          refreshToken: document.cookie
            .split('; ')
            .find(row => row.startsWith('refresh_token='))
            ?.split('=')[1],
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Токены обновлены автоматически через cookies
      console.log('Token refresh successful');

      // Обновляем CSRF токен
      const newCsrfToken = await getCsrfToken();
      setAuthState(prev => ({
        ...prev,
        csrfToken: newCsrfToken,
      }));
    } catch (error) {
      console.error('Token refresh error:', error);
      // При ошибке обновления токена выходим из системы
      await logout();
    }
  };

  // Проверка аутентификации
  const checkAuth = async (): Promise<void> => {
    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const user = await response.json();
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          csrfToken,
        });
      } else {
        // Если токен недействителен, очищаем состояние
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          csrfToken: null,
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        csrfToken: null,
      });
    }
  };

  // Проверка аутентификации при загрузке приложения
  useEffect(() => {
    checkAuth();
  }, []);

  // Автоматическое обновление токена каждые 10 минут
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 10 * 60 * 1000); // 10 минут

    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    logoutAllDevices,
    refreshToken,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
