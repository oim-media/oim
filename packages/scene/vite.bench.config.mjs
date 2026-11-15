// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Bundles bench/scene-entry.ts (the scene, as the drag benchmark loads it) into dist/bench/scene.js.
import { defineConfig } from 'vite';

import { fileURLToPath } from 'node:url';

// Resolve core from source so the build does not depend on core's dist being built first.
const src = (p) => fileURLToPath(new URL(`../core/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@oim-media\/core\/v2$/, replacement: src('v2/index.ts') },
      { find: /^@oim-media\/core$/, replacement: src('index.ts') },
    ],
  },
  logLevel: 'warn',
  build: {
    outDir: 'dist/bench',
    emptyOutDir: false,
    minify: false,
    lib: { entry: 'bench/scene-entry.ts', formats: ['es'], fileName: () => 'scene.js' },
  },
});
