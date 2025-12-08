'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Используем window.location.href для редиректа, чтобы сохранить префикс /admin
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const basePath = currentPath.startsWith('/admin') ? '/admin' : '/admin';
      // Редиректим на /admin/dashboard
      window.location.href = `${basePath}/dashboard`;
    }
  }, []);

  return null;
}

