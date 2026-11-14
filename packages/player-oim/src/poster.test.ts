/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageEngine } from './engines/ImageEngine.js';

// Verification is the one seam mocked: each test sets the verdict the worker would
// have given, so the real engine runs the real load, paint and reveal path.
let verdict: any = null;
vi.mock('./render/file-cache.js', () => ({
  fileCache: {
    sniff: () => Promise.resolve(null),
    getBlob: () => Promise.resolve(new Blob(['oim'])),
    getVerified: () => Promise.resolve(verdict),
  },
}));

await import('./index');

const doc2 = (layers: unknown[]) => ({
  oim: '2.0.0-draft.1',
  canvas: { width: 800, height: 600 },
  languages: ['en'],
  layers,
});
const TEXT = { id: 'titulo', type: 'text', box: { x: 80, y: 40, width: 500, height: 80 }, text: { content: { en: 'Hello' } } };
const BASE = { id: 'fondo', type: 'image', box: { x: 0, y: 0, width: 800, height: 600 }, image: { src: 'oim:base' } };
const DOC_NO_BASE = doc2([TEXT]);
const DOC_WITH_BASE = doc2([BASE, TEXT]);
const DOC_1X = {
  canvas_width: 800,
  canvas_height: 600,
  languages: ['en'],
  slots: [{ id: 'titulo', type: 'text', style: { left: '80px', top: '40px', width: '500px', height: '80px' }, content: { en: 'Hello' } }],
};

const until = async (cond: () => boolean, ms = 4000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};
const make = (attrs: Record<string, string>): HTMLElement => {
  const el = document.createElement('oim-player');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
};
const viewport = (el: HTMLElement) => el.shadowRoot!.querySelector('.oim-player-viewport') as HTMLElement;
const base = (el: HTMLElement) => el.shadowRoot!.querySelector('.oim-player-base') as HTMLElement;
const ready = (el: HTMLElement) => !!el.shadowRoot?.querySelector('.oim-player-viewport')?.classList.contains('oim-viewport--ready');
const slots = (el: HTMLElement) => el.shadowRoot!.querySelectorAll('.oim-slot').length;
// Shown: the base is not faded or removed, and the viewport is not under the reveal veil.
const shown = (el: HTMLElement) => {
  const v = viewport(el);
  const veiled = !v.classList.contains('oim-viewport--ready') && !v.classList.contains('oim-viewport--poster');
  return !veiled && base(el).style.display !== 'none' && base(el).style.opacity !== '0';
};

describe('poster attribute', () => {
  beforeEach(() => { document.body.innerHTML = ''; verdict = null; });
  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

  it('poster="only" mounts no scene: no layers, only the base image shows', async () => {
    verdict = { security: 'verified', metadata: structuredClone(DOC_NO_BASE), announce: false };
    const el = make({ src: 'art.oim', poster: 'only' });
    await until(() => ready(el));
    expect(slots(el)).toBe(0);
    expect(base(el).style.display).not.toBe('none');
    expect(shown(el)).toBe(true);
  });

  it('a 2.0 poster (no base layer) shows its base before the scene is up, then fades it out', async () => {
    verdict = { security: 'verified', metadata: structuredClone(DOC_NO_BASE), announce: false };
    const seen: boolean[] = [];
    const build = ImageEngine.prototype.renderSlots;
    vi.spyOn(ImageEngine.prototype, 'renderSlots').mockImplementation(function (this: ImageEngine, ...args: any[]) {
      seen.push(shown(this.host as HTMLElement));
      return (build as any).apply(this, args);
    });
    const el = make({ src: 'art.oim' });
    await until(() => ready(el));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s)).toBe(true);
    await until(() => base(el).style.display === 'none', 1000);
    expect(shown(el)).toBe(false);
  });

  it('a 2.0 document with a base layer keeps its base under the layers after ready', async () => {
    verdict = { security: 'verified', metadata: structuredClone(DOC_WITH_BASE), announce: false };
    const el = make({ src: 'art.oim' });
    await until(() => ready(el));
    await new Promise((r) => setTimeout(r, 300));
    expect(shown(el)).toBe(true);
  });

  it('a 1.x document keeps its base after ready', async () => {
    verdict = { security: 'verified', metadata: structuredClone(DOC_1X), announce: false };
    const el = make({ src: 'art.oim' });
    await until(() => ready(el));
    await new Promise((r) => setTimeout(r, 300));
    expect(shown(el)).toBe(true);
  });

  it('an unsigned 2.0 file shows its base and nothing on top', async () => {
    verdict = { security: 'unsigned', metadata: { slots: [], elements: [], layers: [] }, announce: false };
    const el = make({ src: 'art.oim' });
    await until(() => ready(el));
    await new Promise((r) => setTimeout(r, 300));
    expect(slots(el)).toBe(0);
    expect(shown(el)).toBe(true);
  });

  it('an unknown poster value behaves as auto', async () => {
    verdict = { security: 'verified', metadata: structuredClone(DOC_NO_BASE), announce: false };
    const el = make({ src: 'art.oim', poster: 'banana' });
    await until(() => ready(el));
    await until(() => base(el).style.display === 'none', 1000);
    expect(shown(el)).toBe(false);
  });
});
