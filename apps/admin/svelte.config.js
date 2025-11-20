import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ compatibility: ['nodejs_compat'] }),
    alias: {
      '@lib': './src/lib',
      '@lib/*': './src/lib/*',
      '@repo': '../../packages',
      '@repo/*': '../../packages/*',
    },
    csp: {
      mode: 'hash',
      directives: {
        'script-src': ['self', 'https://challenges.cloudflare.com'],
        'frame-src': ['https://challenges.cloudflare.com'],
        'connect-src': ['self', 'https://challenges.cloudflare.com'],
      },
    },
  },
};

export default config;
