import { defineConfig } from '@playwright/test';
import config from 'playwright-config';

export default defineConfig({
  ...config,
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
