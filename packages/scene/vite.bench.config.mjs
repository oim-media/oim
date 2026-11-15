// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Bundles bench/scene-entry.ts (the scene, as the drag benchmark loads it) into dist/bench/scene.js.
import { defineConfig } from 'vite';

export default defineConfig({
  logLevel: 'warn',
  build: {
    outDir: 'dist/bench',
    emptyOutDir: false,
    minify: false,
    lib: { entry: 'bench/scene-entry.ts', formats: ['es'], fileName: () => 'scene.js' },
  },
});
