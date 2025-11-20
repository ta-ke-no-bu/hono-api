import path from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from '@repo/vitest-config/vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    resolve: {
      alias: {
        '@shared/utils': path.resolve(__dirname, '../../packages/utils/src'),
      },
    },
    test: {
      environment: 'node', // honoなどのAPIテストでは 'node' を使用、他cloudflareとか適宜書き換える
      globals: true, // Add this line
      include: ['src/tests/**/*.test.ts'],
      exclude: ['**/*.e2e.spec.ts', '**/e2e/**'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
