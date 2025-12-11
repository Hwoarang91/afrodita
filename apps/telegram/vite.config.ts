import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '0.0.0.0', // Слушать на всех интерфейсах для доступа из Docker
    port: parseInt(process.env.FRONTEND_PORT || '3000'),
  },
  build: {
    outDir: 'dist',
  },
  envPrefix: 'VITE_',
});

