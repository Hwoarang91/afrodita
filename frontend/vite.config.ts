import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Слушать на всех интерфейсах для доступа из Docker
    port: parseInt(process.env.FRONTEND_PORT || '3000'),
  },
  build: {
    outDir: 'dist',
  },
  envPrefix: 'VITE_',
});

