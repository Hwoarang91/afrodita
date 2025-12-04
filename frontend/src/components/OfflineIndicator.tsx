import { useOnlineStatus } from '../hooks/useOnlineStatus';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isOnline) {
      toast.error('Нет подключения к интернету', {
        duration: Infinity,
        id: 'offline-toast',
      });
    } else {
      toast.dismiss('offline-toast');
      toast.success('Подключение восстановлено', {
        duration: 3000,
      });
    }
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50">
      <p className="text-sm font-medium">⚠️ Нет подключения к интернету</p>
    </div>
  );
}

