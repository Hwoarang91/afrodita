'use client';

import { useEffect, useState } from 'react';

interface ErrorToastProps {
  message: string;
  type?: 'error' | 'warning' | 'success' | 'info';
  duration?: number;
  onClose?: () => void;
}

export function ErrorToast({
  message,
  type = 'error',
  duration = 5000,
  onClose,
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Ждем завершения анимации
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  const bgColors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full border rounded-lg shadow-lg p-4 flex items-start gap-3 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-10px]'
      } ${bgColors[type]}`}
    >
      <span className="text-xl flex-shrink-0">{icons[type]}</span>
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose?.(), 300);
        }}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}

interface ErrorToastContainerProps {
  children: React.ReactNode;
}

export function ErrorToastContainer({ children }: ErrorToastContainerProps) {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ErrorToastProps['type'] }>>([]);

  const showToast = (message: string, type: ErrorToastProps['type'] = 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  useEffect(() => {
    // Глобальные функции для показа toast
    (window as any).showErrorToast = (message: string) => showToast(message, 'error');
    (window as any).showSuccessToast = (message: string) => showToast(message, 'success');
    (window as any).showWarningToast = (message: string) => showToast(message, 'warning');
    (window as any).showInfoToast = (message: string) => showToast(message, 'info');
    return () => {
      delete (window as any).showErrorToast;
      delete (window as any).showSuccessToast;
      delete (window as any).showWarningToast;
      delete (window as any).showInfoToast;
    };
  }, []);

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast, index) => (
          <div key={toast.id} className="pointer-events-auto" style={{ marginTop: `${index * 4}px` }}>
            <ErrorToast
              message={toast.message}
              type={toast.type}
              onClose={() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

