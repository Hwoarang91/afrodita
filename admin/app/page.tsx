'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Определяем базовый путь из текущего URL
    const basePath = pathname.startsWith('/admin') ? '/admin' : '';
    router.push(`${basePath}/dashboard`);
  }, [router, pathname]);

  return null;
}

