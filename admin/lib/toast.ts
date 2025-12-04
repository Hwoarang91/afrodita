// Утилита для показа toast уведомлений
export const toast = {
  error: (message: string) => {
    if (typeof window !== 'undefined' && (window as any).showErrorToast) {
      (window as any).showErrorToast(message);
    } else {
      console.error('Toast not available:', message);
    }
  },
  success: (message: string) => {
    if (typeof window !== 'undefined' && (window as any).showSuccessToast) {
      (window as any).showSuccessToast(message);
    } else {
      console.log('Toast not available:', message);
    }
  },
  warning: (message: string) => {
    if (typeof window !== 'undefined' && (window as any).showWarningToast) {
      (window as any).showWarningToast(message);
    } else {
      console.warn('Toast not available:', message);
    }
  },
  info: (message: string) => {
    if (typeof window !== 'undefined' && (window as any).showInfoToast) {
      (window as any).showInfoToast(message);
    } else {
      console.info('Toast not available:', message);
    }
  },
};

