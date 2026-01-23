import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { injectBuildTime } from './vite-plugins/inject-build-time';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');

  // Determine base path:
  // - In dev mode: always '/'
  // - In build mode: use VITE_BASE_PATH env var or default to '/'
  const base = command === 'build'
    ? (env.VITE_BASE_PATH || '/')
    : '/';

  return {
    base,
    server: {
      port: 4000,
      host: '0.0.0.0',
    },
    plugins: [react(), injectBuildTime()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'docs'
    }
  };
});
