import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
      // dataML/ holds ~20k CSV files (~40 GB) of ML training data. Without
      // this ignore list, chokidar tries to watch every one of them on
      // dev-server start, which pegs CPU and balloons memory until the
      // machine becomes unresponsive.
      watch: {
        ignored: [
          '**/dataML/**',
          '**/server/**',
          '**/screenshot/**',
          '**/dist/**',
        ],
      },
    },
    // Pre-bundle heavy deps so cold dev-starts don't re-discover them on every
    // navigation. @mediapipe/tasks-vision is excluded because it's loaded
    // lazily inside useKneePipeline and pulls in a large WASM payload.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'lucide-react',
        'motion/react',
        'recharts',
        'clsx',
        'tailwind-merge',
      ],
      exclude: ['@mediapipe/tasks-vision'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            charts: ['recharts'],
            motion: ['motion/react'],
          },
        },
      },
    },
  };
});
