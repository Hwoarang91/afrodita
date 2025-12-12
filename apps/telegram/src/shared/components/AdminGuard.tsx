import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from './LoadingSpinner';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем, является ли пользователь администратором
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Показываем загрузку, пока не проверили права
  if (!user) {
    return <LoadingSpinner />;
  }

  // Если пользователь не админ, ничего не показываем (редирект произойдет)
  if (user.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}

