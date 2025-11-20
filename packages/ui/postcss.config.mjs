import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const config = {
  plugins: {
    '@tailwindcss/postcss': { base: baseDir },
  },
};

export default config;
