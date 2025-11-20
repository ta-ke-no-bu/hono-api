import { defineConfig } from 'vitest/config';

export const sharedVitestConfig = defineConfig({
  test: {
    globals: true,
    // You can add common setup files here if needed
    // setupFiles: [],
  },
});
