import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
