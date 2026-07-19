import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'happy-dom',
    environment: 'happy-dom',
    include: ['src/specs/**/*.spec.ts'],
  },
});
