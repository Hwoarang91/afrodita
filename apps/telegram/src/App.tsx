import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { TelegramProvider } from './contexts/TelegramContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LoadingSpinner from './shared/components/LoadingSpinner';
import OfflineIndicator from './shared/components/OfflineIndicator';
import AdminRedirect from './shared/components/AdminRedirect';
import toast from 'react-hot-toast';

// Code splitting - ленивая загрузка страниц
const Onboarding = lazy(() => import('./features/auth/Onboarding'));
const Auth = lazy(() => import('./features/auth/page'));
const Services = lazy(() => import('./features/services/page'));
const ServiceDetail = lazy(() => import('./features/services/ServiceDetail'));
const MasterSelection = lazy(() => import('./features/services/MasterSelection'));
const Calendar = lazy(() => import('./features/appointments/Calendar'));
const AppointmentConfirmation = lazy(() => import('./features/appointments/AppointmentConfirmation'));
const ConfirmBooking = lazy(() => import('./features/appointments/ConfirmBooking'));
const BookingSuccess = lazy(() => import('./features/appointments/BookingSuccess'));
const Profile = lazy(() => import('./features/profile/page'));
const History = lazy(() => import('./features/appointments/History'));
const Notifications = lazy(() => import('./features/profile/Notifications'));
const Reschedule = lazy(() => import('./features/appointments/Reschedule'));
const AdminPage = lazy(() => import('./features/admin/page'));
const AppointmentsPage = lazy(() => import('./features/admin/AppointmentsPage'));
const ClientsPage = lazy(() => import('./features/admin/ClientsPage'));
const MastersPage = lazy(() => import('./features/admin/MastersPage'));
const ServicesPage = lazy(() => import('./features/admin/ServicesPage'));
const StatsPage = lazy(() => import('./features/admin/StatsPage'));
const NotFound = lazy(() => import('./shared/NotFound'));

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
          <BrowserRouter basename="/app">
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
                <Route path="/confirm-final" element={<ConfirmBooking />} />
                <Route path="/booking-success/:appointmentId" element={<BookingSuccess />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/reschedule/:id" element={<Reschedule />} />
                {/* Админ-панель */}
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/appointments" element={<AppointmentsPage />} />
                <Route path="/admin/clients" element={<ClientsPage />} />
                <Route path="/admin/masters" element={<MastersPage />} />
                <Route path="/admin/services" element={<ServicesPage />} />
                <Route path="/admin/stats" element={<StatsPage />} />
                {/* Редирект админ-панели на правильный путь */}
                <Route path="/login" element={<AdminRedirect />} />
                <Route path="/register" element={<AdminRedirect />} />
                {/* Страница 404 для всех остальных путей */}
                <Route path="*" element={<NotFound />} />
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

