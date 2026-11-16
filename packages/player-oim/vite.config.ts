/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, copyFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LOTTIE_PKG = require.resolve('lottie-web/package.json');
const LOTTIE_VERSION: string = JSON.parse(readFileSync(LOTTIE_PKG, 'utf8')).version;
const LOTTIE_LIGHT = resolve(LOTTIE_PKG, '..', 'build/player/lottie_light.min.js');

// `upgrade` ships as its own file next to the player. Its name carries a hash
// of the sources that make it, so a new player never meets an old cached one.
const CORE_SRC = resolve(import.meta.dirname, '../core/src');
function sourcesOf(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((entry) => {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) return sourcesOf(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}
const UPGRADE_HASH = createHash('sha256').update(sourcesOf(CORE_SRC).map((p) => readFileSync(p)).join('|')).digest('hex').slice(0, 12);
const UPGRADE_FILE = `oim-upgrade-${UPGRADE_HASH}.js`;
const GENERATIVE_FILE = `oim-generative-${UPGRADE_HASH}.js`;
const PATTERNS_FILE = `oim-patterns-${UPGRADE_HASH}.js`;

// The parts the player fetches on demand: built after the player, into its vendor/.
const LEGACY = resolve(import.meta.dirname, '../scene/src/legacy');
const VENDOR_PARTS: Record<string, { entry: string; name: string; file: string }> = {
  upgrade: { entry: 'upgrade-global.ts', name: 'OimUpgrade', file: UPGRADE_FILE },
  generative: { entry: 'generative-global.ts', name: 'OimGenerative', file: GENERATIVE_FILE },
  patterns: { entry: 'patterns-global.ts', name: 'OimPatterns', file: PATTERNS_FILE },
};

function copyVendorPlugin(file: string) {
  return {
    name: 'copy-vendor-part',
    closeBundle() {
      const src = resolve(import.meta.dirname, 'dist/vendor', file);
      const out = resolve(import.meta.dirname, 'dist/player/v1/vendor');
      mkdirSync(out, { recursive: true });
      copyFileSync(src, resolve(out, file));
    }
  };
}

// The CDN site is built from this package alone and `dist/` is served as the
// site root, so the versioned copy is produced here, in this build. Lottie is
// published next to both copies, because the player resolves vendor/ against
// its own URL.
function versionedCopyPlugin() {
  return {
    name: 'copy-versioned-player',
    closeBundle() {
      const src = resolve(import.meta.dirname, 'dist/oim-player.js');
      const versionedDir = resolve(import.meta.dirname, 'dist/player/v1');
      mkdirSync(versionedDir, { recursive: true });
      copyFileSync(src, resolve(versionedDir, 'oim-player.js'));
      for (const dir of ['dist/vendor', 'dist/player/v1/vendor']) {
        const out = resolve(import.meta.dirname, dir);
        mkdirSync(out, { recursive: true });
        copyFileSync(LOTTIE_LIGHT, resolve(out, `lottie_light-${LOTTIE_VERSION}.js`));
      }
    }
  };
}

// `--mode esm` builds the npm package: ES module, Lottie and core left as
// real imports for the consumer's bundler (it code-splits the dynamic import),
// no CDN files. The default build is the single-file iife served by the CDN.
export default defineConfig(({ command, mode }) => VENDOR_PARTS[mode] ? {
  plugins: [copyVendorPlugin(VENDOR_PARTS[mode].file)],
  publicDir: false,
  build: {
    lib: { entry: resolve(LEGACY, VENDOR_PARTS[mode].entry), name: VENDOR_PARTS[mode].name, fileName: () => VENDOR_PARTS[mode].file, formats: ['iife'] },
    outDir: 'dist/vendor',
    emptyOutDir: false,
    minify: true
  }
} : mode === 'esm' ? {
  build: {
    lib: { entry: resolve(import.meta.dirname, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
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
    __OIM_LOTTIE_VERSION__: JSON.stringify(LOTTIE_VERSION),
    __OIM_UPGRADE_FILE__: JSON.stringify(UPGRADE_FILE),
    __OIM_GENERATIVE_FILE__: JSON.stringify(GENERATIVE_FILE),
    __OIM_PATTERNS_FILE__: JSON.stringify(PATTERNS_FILE)
  },
  // Only in `vite build`: an `iife` inlines every import(), so the real
  // lottie_light would land in the bundle. vitest runs as `serve` and keeps
  // the real library.
  resolve: command === 'build'
    ? { alias: [
        { find: 'lottie-web/build/player/lottie_light', replacement: resolve(import.meta.dirname, '../scene/src/legacy/lottie-external.ts') },
        { find: /^\.\/upgrade-entry\.js$/, replacement: resolve(LEGACY, 'upgrade-external.ts') },
        { find: /^\.\/features-entry\.js$/, replacement: resolve(LEGACY, 'features-external.ts') },
        { find: /^\.\/generative\/index\.js$/, replacement: resolve(LEGACY, 'generative-external.ts') },
        { find: /^(\.\/|(\.\.\/)+core\/src\/)patterns\.js$/, replacement: resolve(LEGACY, 'patterns-external.ts') },
      ] }
    : {},
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
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
