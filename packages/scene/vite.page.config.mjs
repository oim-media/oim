// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0
// Bundles bench/scene-page.ts (the visual gate's page) into dist/scene-page.js.
import { defineConfig } from 'vite';

export default defineConfig({
  logLevel: 'warn',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    lib: { entry: 'bench/scene-page.ts', formats: ['es'], fileName: () => 'scene-page.js' },
  },
});
