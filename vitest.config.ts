import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['packages/inference-worker/**'],
      include: ['packages/*/src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 70,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: 'node',
          include: ['packages/**/*.test.ts'],
          name: 'domain',
        },
      },
      {
        extends: true,
        test: {
          environment: 'jsdom',
          include: ['apps/**/*.test.{ts,tsx}'],
          name: 'app',
        },
      },
    ],
  },
});
