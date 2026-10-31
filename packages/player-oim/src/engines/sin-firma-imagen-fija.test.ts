/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

let currentVerdict: string = 'unsigned';

vi.mock('../core/security.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/security.js')>();
  return {
    ...actual,
    securityVerdict: vi.fn((input: any) => currentVerdict as any),
  };
});

import ImageEngine from './ImageEngine';

const oimFilePath = path.resolve(__dirname, '../../test/fixtures/object_view.oim.png');
const oimBuffer = fs.readFileSync(oimFilePath);

function blobDePrueba(): Blob {
  return new Blob([oimBuffer], { type: 'image/png' });
}

function montarConVeredicto(veredicto: string) {
  currentVerdict = veredicto;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const engine = new ImageEngine(host as any) as any;
  Object.defineProperty(engine, 'shadow', {
    get: () => host.shadowRoot,
  });
  return engine;
}

describe('sin firma, imagen fija', () => {
  let createdHosts: HTMLElement[] = [];

  beforeEach(() => {
    createdHosts = [];
  });

  afterEach(() => {
    createdHosts.forEach((h) => {
      if (h.parentNode) h.parentNode.removeChild(h);
    });
    createdHosts = [];
    vi.restoreAllMocks();
  });

  // An unsigned .oim is a PNG with data inside: it is seen, but it does not animate nor
  // respond. Interactivity is the only thing that can touch the host page, so it only
  // proceeds from files of known origin.
  it('con veredicto unsigned no compone ninguna capa', async () => {
    const engine = montarConVeredicto('unsigned');
    createdHosts.push(engine.host);
    await engine.load(blobDePrueba());
    expect(engine.shadow.querySelectorAll('[data-slot-id]')).toHaveLength(0);
    expect(engine.shadow.querySelector('img')).not.toBeNull();
    expect(engine.host.getAttribute('data-oim-sin-firma')).not.toBeNull();
  });

  it('con sello antiguo (image_unsealed) SI compone: son archivos legitimos', async () => {
    const engine = montarConVeredicto('image_unsealed');
    createdHosts.push(engine.host);
    await engine.load(blobDePrueba());
    expect(engine.shadow.querySelectorAll('[data-slot-id]').length).toBeGreaterThan(0);
  });
});
