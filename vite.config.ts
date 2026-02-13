import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? pkg.version),
    __APP_BUILD_COMMIT__: JSON.stringify(process.env.VITE_APP_BUILD_COMMIT ?? process.env.GIT_COMMIT ?? ''),
    __APP_BUILD_DATE__: JSON.stringify(process.env.VITE_APP_BUILD_DATE ?? process.env.BUILD_DATE ?? '')
  },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts'
  }
});
