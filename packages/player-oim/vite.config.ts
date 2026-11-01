import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, copyFileSync, readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LOTTIE_PKG = require.resolve('lottie-web/package.json');
const LOTTIE_VERSION: string = JSON.parse(readFileSync(LOTTIE_PKG, 'utf8')).version;
const LOTTIE_LIGHT = resolve(LOTTIE_PKG, '..', 'build/player/lottie_light.min.js');

// The CDN site is built from this package alone and `dist/` is served as the
// site root, so the versioned copy is produced here, in this build. Lottie is
// published next to both copies, because the player resolves vendor/ against
// its own URL.
function versionedCopyPlugin() {
  return {
    name: 'copy-versioned-player',
    closeBundle() {
      const src = resolve(__dirname, 'dist/oim-player.js');
      const versionedDir = resolve(__dirname, 'dist/player/v1');
      mkdirSync(versionedDir, { recursive: true });
      copyFileSync(src, resolve(versionedDir, 'oim-player.js'));
      for (const dir of ['dist/vendor', 'dist/player/v1/vendor']) {
        const out = resolve(__dirname, dir);
        mkdirSync(out, { recursive: true });
        copyFileSync(LOTTIE_LIGHT, resolve(out, `lottie_light-${LOTTIE_VERSION}.js`));
      }
    }
  };
}

// `--mode esm` builds the npm package: ES module, Lottie and core left as
// real imports for the consumer's bundler (it code-splits the dynamic import),
// no CDN files. The default build is the single-file iife served by the CDN.
export default defineConfig(({ command, mode }) => mode === 'esm' ? {
  build: {
    lib: { entry: resolve(__dirname, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
    outDir: 'dist/esm',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: false,
    rollupOptions: { external: [/^lottie-web/, /^@oim-media\/core/] }
  },
  worker: { format: 'es' }
} : ({
  plugins: [versionedCopyPlugin()],
  publicDir: false,
  define: {
    __OIM_LOTTIE_VERSION__: JSON.stringify(LOTTIE_VERSION)
  },
  // Only in `vite build`: an `iife` inlines every import(), so the real
  // lottie_light would land in the bundle. vitest runs as `serve` and keeps
  // the real library.
  resolve: command === 'build'
    ? { alias: { 'lottie-web/build/player/lottie_light': resolve(__dirname, 'src/render/lottie-external.ts') } }
    : {},
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'OimPlayer',
      fileName: () => 'oim-player.js',
      formats: ['iife']
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: true
  },
  worker: {
    format: 'es'
  }
}));
