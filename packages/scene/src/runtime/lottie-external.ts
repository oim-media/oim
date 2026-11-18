/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OWN_SCRIPT_SRC } from './own-script.js';

declare const __OIM_LOTTIE_VERSION__: string;

/** Where Lottie lives when the player is served without a CDN URL to resolve against. */
const FALLBACK_BASE = 'https://cdn.oim.media/player/v1/';

export function vendorUrl(scriptUrl: string | null, version: string): string {
  const file = `vendor/lottie_light-${version}.js`;
  if (scriptUrl) {
    try { return new URL(file, scriptUrl).href; } catch { /* fall through */ }
  }
  return FALLBACK_BASE + file;
}

/** Loads one script that lives next to the player, once per page; `read` says what it defined. */
export function createExternalScriptLoader(opts: { scriptUrl: string | null; file: string; marker: string; read: () => any; doc?: Document }): () => Promise<any> {
  let pending: Promise<any> | null = null;
  return function load() {
    const existing = opts.read();
    if (existing) return Promise.resolve(existing);
    if (pending) return pending;
    const doc = opts.doc ?? document;
    let url = FALLBACK_BASE + opts.file;
    if (opts.scriptUrl) {
      try { url = new URL(opts.file, opts.scriptUrl).href; } catch { /* fall back */ }
    }
    pending = new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = url;
      script.async = true;
      script.setAttribute(opts.marker, '');
      script.onload = () => {
        const lib = opts.read();
        if (lib) resolve(lib);
        else reject(new Error(`Script loaded from ${url} but did not define what was expected`));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${url}`));
      };
      (doc.head || doc.documentElement).appendChild(script);
    });
    // A failed load must not poison the page: the next call retries.
    pending.catch(() => { pending = null; });
    return pending;
  };
}

/**
 * Loads lottie_light as a separate <script>, once per page.
 *
 * The CDN player is a single `iife`, which inlines every `import()`: a dynamic
 * import of lottie_light put 164 KB into every page that embeds a .oim, with or
 * without Lottie. The package build aliases lottie_light to this module, so the
 * library is only downloaded when a Lottie layer is actually painted.
 */
export function createExternalLottieLoader(opts: { scriptUrl: string | null; version: string; doc?: Document }): () => Promise<any> {
  return createExternalScriptLoader({
    scriptUrl: opts.scriptUrl,
    file: `vendor/lottie_light-${opts.version}.js`,
    marker: 'data-oim-lottie',
    doc: opts.doc,
    read: () => {
      const lib = (globalThis as any).lottie;
      return lib && typeof lib.loadAnimation === 'function' ? lib : undefined;
    },
  });
}

const load = createExternalLottieLoader({
  scriptUrl: OWN_SCRIPT_SRC,
  version: typeof __OIM_LOTTIE_VERSION__ !== 'undefined' ? __OIM_LOTTIE_VERSION__ : '',
});

/** Shape `lottie-loader.ts` recognises: an external loader instead of the library itself. */
export default { __oimExternal: true as const, load };
