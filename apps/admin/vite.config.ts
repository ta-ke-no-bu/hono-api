import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Cloudflare向けビルド時に wrangler/miniflare が z.ostring() を参照するための後方互換パッチ
const patchedSymbol: unique symbol = Symbol.for('zod-ostring-patched');

type PatchedExports = Record<PropertyKey, unknown> & {
  [patchedSymbol]?: boolean;
};

type PatchedModule = typeof Module & {
  _load: (request: string, parent: NodeJS.Module | null, isMain: boolean) => unknown;
};

const moduleWithLoad = Module as PatchedModule;
const originalLoad = moduleWithLoad._load.bind(Module);

moduleWithLoad._load = function patchedModuleLoad(request, parent, isMain) {
  const exportsValue = originalLoad(request, parent, isMain);
  if (request === 'zod' && exportsValue && typeof exportsValue === 'object') {
    const patchedExports = exportsValue as PatchedExports;
    if (!patchedExports[patchedSymbol]) {
      const originalZ = Reflect.get(exportsValue, 'z');
      if (originalZ && typeof originalZ === 'object' && !('ostring' in originalZ)) {
        const zProxy = new Proxy(originalZ, {
          get(target, prop, receiver) {
            if (prop === 'function') {
              const factory = Reflect.get(target, prop, receiver);
              if (typeof factory === 'function') {
                return (...args: unknown[]) => {
                  const schema = factory.apply(target, args);
                  if (schema && typeof schema === 'object' && schema !== null) {
                    const returnMethod = Reflect.get(schema, 'output', schema.returnType ?? null);
                    if (typeof returnMethod === 'function' && typeof schema.returns !== 'function') {
                      Reflect.set(schema, 'returns', (...innerArgs: unknown[]) => returnMethod.apply(schema, innerArgs));
                    }
                  }
                  return schema;
                };
              }
            }
            if (typeof prop === 'string' && prop.startsWith('o')) {
              const baseName = prop.slice(1);
              const baseFactory = Reflect.get(target, baseName, receiver);
              if (typeof baseFactory === 'function') {
                return (...args: unknown[]) => {
                  const schema = baseFactory.apply(target, args);
                  const optionalMethod = Reflect.get(schema ?? {}, 'optional');
                  if (typeof optionalMethod === 'function') {
                    return optionalMethod.apply(schema);
                  }
                  return schema;
                };
              }
            }
            return Reflect.get(target, prop, receiver);
          },
        });

        patchedExports[patchedSymbol] = true;
        return new Proxy(patchedExports, {
          get(target, prop, receiver) {
            if (prop === 'z') {
              return zProxy;
            }
            if (prop === patchedSymbol) {
              return true;
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      }
    }
  }
  return exportsValue;
};

// Cloudflare Pagesなど配置パスが異なる環境でもワークスペース内のpackagesを解決する
const packagesDir = fileURLToPath(new URL('../../packages', import.meta.url));
const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  server: {
    host: true,
  },
  ssr: {
    noExternal: ['@repo/ui'],
  },
  optimizeDeps: {
    include: ['@repo/ui'],
    exclude: ['clsx'],
  },
  resolve: {
    alias: {
      '@repo': packagesDir,
      '@repo/*': `${packagesDir}/*`,
      '@lib': `${srcDir}/lib`,
      '@lib/*': `${srcDir}/lib/*`,
    },
  },
});
