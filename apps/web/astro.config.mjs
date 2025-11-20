import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import relativeLinks from 'astro-relative-links';
import { site } from './src/config/site.ts';
import tailwindcss from '@tailwindcss/vite';

// Dockerコンテナ外でもモノレポの共有パッケージを解決するための絶対パス
const packagesDir = fileURLToPath(new URL('../../packages', import.meta.url));

// https://astro.build/config
export default defineConfig({
	site: process.env.WEB_BASE_URL || site.root,
  base: process.env.WEB_BASE_PATH || site.basePathname,
	trailingSlash: site.trailingSlash ? 'always' : 'never',
  compressHTML: site.compressHTML ? true : false,
  adapter: cloudflare({ mode: 'pages' }),
  integrations: [
    svelte({
      prebundleSvelteLibraries: false
    }),
    relativeLinks(),
    (await import('astro-compress')).default({
      HTML: true,
      CSS: true,
      JavaScript: true,
      Image: true,
      SVG: false,
    }),
    sitemap()
  ],
	build: {
    format: site.trailingSlash ? 'directory' : 'file'
  },
	vite: {
    server: {
      watch: {
        usePolling: true,
      },
    },
    ssr: {
      noExternal: ['@repo/ui']
    },
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: ['@repo/ui'],
      exclude: ['sass']
    },
    envPrefix: 'NEWT_',
    define: {
      'import.meta.env.WEB_BASE_URL': JSON.stringify(import.meta.env.WEB_BASE_URL || site.root),
      'import.meta.env.WEB_BASE_PATH': JSON.stringify(import.meta.env.WEB_BASE_PATH || site.basePathname),
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(
        (process.env.PUBLIC_API_URL ?? 'http://localhost:8787/app/api')
      ),
      'import.meta.env.PUBLIC_TURNSTILE_SITE_KEY': JSON.stringify(
        process.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'
      ),
    },
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name].js',
        },
      },
    },
    resolve: {
      alias: {
        '@repo': packagesDir,
      },
    },
  },
});
