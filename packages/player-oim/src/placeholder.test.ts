/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The engine is replaced by a stub whose load() waits for the test to resolve
// it: "the engine has painted" becomes a deterministic event, not a timing.
const loads: Array<{ resolve: (v: boolean) => void; reject: (e: unknown) => void }> = [];
vi.mock('./engines/ImageEngine.js', () => ({
  ImageEngine: class {
    constructor(public host: Element) {}
    load() {
      return new Promise<boolean>((resolve, reject) => loads.push({ resolve, reject }));
    }
    destroy() {}
    pause() {}
    applyPalette() {}
  },
}));
vi.mock('./render/file-cache.js', () => ({
  fileCache: { sniff: () => Promise.resolve(null) },
}));

await import('./index');

// A data: URL so happy-dom never goes to the network: a remote thumbnail that
// fails would fire `error` and remove itself, and the tests would pass for the wrong reason.
const THUMB = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const THUMB_2 = 'data:image/gif;base64,R0lGODlhAQABAIAAAP8=';
const flush = () => new Promise((r) => setTimeout(r, 0));

function make(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('oim-player');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}
const thumb = (el: HTMLElement) => (el.shadowRoot?.querySelector('img.oim-placeholder') ?? null) as HTMLImageElement | null;

describe('placeholder attribute', () => {
  beforeEach(() => { document.body.innerHTML = ''; loads.length = 0; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows the placeholder image with its src before the engine loads', async () => {
    const el = make({ src: 'art.oim', placeholder: THUMB });
    const img = thumb(el);
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(THUMB);
    expect(img!.getAttribute('alt')).toBe('');
    expect(img!.getAttribute('decoding')).toBe('async');
  });

  it('removes the placeholder once the engine has loaded', async () => {
    const el = make({ src: 'art.oim', placeholder: THUMB });
    await flush();
    expect(loads.length).toBe(1);
    loads[0].resolve(true);
    await flush();
    expect(thumb(el) ?? null).toBeNull();
  });

  it('removes the placeholder when the engine load fails, so the error UI shows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = make({ src: 'art.oim', placeholder: THUMB });
    await flush();
    loads[0].reject(new Error('boom'));
    await flush();
    expect(thumb(el)).toBeNull();
    warn.mockRestore();
  });

  it('uses object-fit cover for fit="cover" and contain by default', async () => {
    const cover = make({ src: 'a.oim', placeholder: THUMB, fit: 'cover' });
    const contain = make({ src: 'b.oim', placeholder: THUMB });
    expect(thumb(cover)!.getAttribute('style')).toContain('object-fit:cover');
    expect(thumb(contain)!.getAttribute('style')).toContain('object-fit:contain');
  });

  it('accepts http(s) URLs and ignores javascript: and other schemes', () => {
    const remote = make({ src: 'a.oim', placeholder: 'https://cdn.example.com/thumb.jpg' });
    expect(thumb(remote)!.getAttribute('src')).toBe('https://cdn.example.com/thumb.jpg');
    const js = make({ src: 'b.oim', placeholder: 'javascript:alert(1)' });
    expect(thumb(js)).toBeNull();
    const ftp = make({ src: 'c.oim', placeholder: 'ftp://cdn.example.com/x.jpg' });
    expect(thumb(ftp)).toBeNull();
  });

  it('updates the src when the attribute changes, and removes the image when it is removed', async () => {
    const el = make({ src: 'art.oim', placeholder: THUMB });
    el.setAttribute('placeholder', THUMB_2);
    expect(thumb(el)!.getAttribute('src')).toBe(THUMB_2);
    el.removeAttribute('placeholder');
    expect(thumb(el)).toBeNull();
  });
});
