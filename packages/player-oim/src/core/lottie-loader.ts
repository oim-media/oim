/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The only way the player reaches Lottie.
 *
 * In the CDN build, vite.config.ts aliases lottie_light to lottie-external.ts,
 * so this import resolves to a tiny loader that fetches vendor/lottie_light-*.js
 * on demand. Everywhere else (vitest, apps/studio) it is the real library, and
 * apps/studio's ES build splits it into its own chunk.
 */
export function loadLottie(): Promise<any> {
  return import('lottie-web/build/player/lottie_light').then((m: any) => {
    const lib = m.default || m;
    return lib && lib.__oimExternal ? lib.load() : lib;
  });
}
