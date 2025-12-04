/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Загружаем переменные из корневого .env
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1',
  },
  // Настройка для правильной работы чанков в Docker
  webpack: (config, { isServer, dev }) => {
    // Исправление для динамических импортов
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
      
      // В dev режиме настраиваем правильные пути к чанкам
      if (dev && config.output) {
        // Убеждаемся, что publicPath установлен правильно
        config.output.publicPath = '/_next/';
      }
    }
    
    return config;
  },
  // Улучшенная обработка чанков
  experimental: {
    optimizePackageImports: ['react-apexcharts', 'apexcharts'],
  },
  // Настройки для dev сервера
  devIndicators: {
    buildActivity: false,
  },
}

module.exports = nextConfig

