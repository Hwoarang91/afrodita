'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorToastContainer } from './components/ErrorToast';
import Sidebar from './components/Sidebar';
import { Header } from './components/Header';

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isTelegramAuthPage = pathname === '/admin/telegram-auth' || pathname === '/telegram-auth';
  const isAuthPage = isLoginPage || isRegisterPage || isTelegramAuthPage;

  return (
    <ErrorBoundary>
      <ErrorToastContainer>
        <AuthGuard>
          {isAuthPage ? (
            <>{children}</>
          ) : (
            <div className="flex h-screen bg-background transition-colors">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto">
                  <div className="container mx-auto px-4 lg:px-6 py-6">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          )}
        </AuthGuard>
      </ErrorToastContainer>
    </ErrorBoundary>
  );
}

