import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  stories: [
    '../src/lib/components/**/*.stories.@(js|ts|svelte)', // 共通UIコンポーネント // webアプリのコンポーネント
  ],
    addons: [
    '@storybook/addon-links',
    '@storybook/addon-svelte-csf',
    '@storybook/addon-docs', // Docsアドオンを追加
  ],
  framework: {
    name: '@storybook/sveltekit',
    options: {},
  },
  docs: {},
};

export default config;