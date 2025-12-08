'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Определяем базовый путь из window.location, так как Nginx удаляет префикс /admin
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const basePath = currentPath.startsWith('/admin') ? '/admin' : '';
    router.push(`${basePath}/dashboard`);
  }, [router]);

  return null;
}

