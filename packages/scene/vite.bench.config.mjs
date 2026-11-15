// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Bundles bench/scene-entry.ts (the scene, as the drag benchmark loads it) into dist/bench/scene.js.
import { defineConfig } from 'vite';

import { fileURLToPath } from 'node:url';

// Resolve core from source so the build does not depend on core's dist being built first.
const core = fileURLToPath(new URL('../core/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@oim-media/core': core } },
  logLevel: 'warn',
  build: {
    outDir: 'dist/bench',
    emptyOutDir: false,
    minify: false,
    lib: { entry: 'bench/scene-entry.ts', formats: ['es'], fileName: () => 'scene.js' },
  },
});
