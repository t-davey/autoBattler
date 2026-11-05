import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build loads from both a web host and Electron's file://.
  base: './',
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
});
