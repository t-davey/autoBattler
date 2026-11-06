import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build loads from Electron's file://.
  base: './',
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
