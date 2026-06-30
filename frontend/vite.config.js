import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      watch: {
        // Docker on Mac/Windows doesn't propagate inotify events across the bind mount;
        // polling ensures Vite sees file changes without a container restart.
        usePolling: true,
        interval: 500,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        }
      }
    }
  };
});
