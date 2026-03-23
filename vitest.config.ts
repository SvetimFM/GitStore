import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 300_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    sequence: { concurrent: false },
  },
});
