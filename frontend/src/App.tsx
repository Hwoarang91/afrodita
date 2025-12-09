import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { TelegramProvider } from './contexts/TelegramContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import OfflineIndicator from './components/OfflineIndicator';
import toast from 'react-hot-toast';

// Code splitting - ленивая загрузка страниц
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Auth = lazy(() => import('./pages/Auth'));
const Services = lazy(() => import('./pages/Services'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const MasterSelection = lazy(() => import('./pages/MasterSelection'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AppointmentConfirmation = lazy(() => import('./pages/AppointmentConfirmation'));
const Profile = lazy(() => import('./pages/Profile'));
const History = lazy(() => import('./pages/History'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reschedule = lazy(() => import('./pages/Reschedule'));

// Настройка QueryClient с retry механизмом и обработкой ошибок
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Не повторяем запросы для 4xx ошибок (кроме 401, 403)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          if (error?.response?.status === 401 || error?.response?.status === 403) {
            return failureCount < 1; // Один раз для refresh token
          }
          return false;
        }
        // Повторяем для сетевых ошибок и 5xx
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 минут
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        const message = error?.response?.data?.message || error?.message || 'Произошла ошибка';
        toast.error(message);
      },
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TelegramProvider>
          <BrowserRouter>
            <OfflineIndicator />
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Onboarding />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/:id" element={<ServiceDetail />} />
                <Route path="/masters" element={<MasterSelection />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/confirm" element={<AppointmentConfirmation />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/reschedule/:id" element={<Reschedule />} />
              </Routes>
            </Suspense>
            <Toaster 
              position="top-center"
              containerStyle={{
                top: '1rem',
              }}
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                  fontSize: '0.875rem',
                  padding: '0.75rem 1rem',
                  maxWidth: '90vw',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </BrowserRouter>
        </TelegramProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

