/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Attribute values from the file (font family, layer id, colours) must not be
// able to break out of their attribute and inject markup into the host page.
import { describe, expect, it } from 'vitest';
import { upgrade } from '../../../core/src/v2/upgrade.js';
import { applyArtistic } from './artistic.js';
import { generateArtisticTextSvgString, buildArtisticTextModelFromSlot } from './artisticText.js';

const HOSTILE_FONT = 'x"/><image href="x" onerror="alert(1)"/><text a="';
const HOSTILE_ID = 'a" onload="alert(1)';
const HOSTILE_COLOUR = 'red" onmouseover="alert(1)';

const slot = (id: string, style: Record<string, unknown> = {}) => ({
  id,
  type: 'artistic-text',
  position: [0, 0],
  content: { es: 'Hola' },
  style: { width: '50.0cqw', height: '25.0cqw', fontSize: '8.0cqw', fontFamily: 'Inter', ...style },
});

const layerOf = (s: ReturnType<typeof slot>) =>
  upgrade({ oim: '1.27.9', canvas: { natural_width: 800, natural_height: 600 }, slots: [s] }).document.layers[0];

const paint = (layer: ReturnType<typeof layerOf>) => {
  const el = document.createElement('div');
  applyArtistic(el, layer as never, { lang: 'es', literal: (v: unknown) => (typeof v === 'string' ? v : undefined) });
  return el;
};

// Nothing in the painted subtree may be an <image> element or carry an on* handler.
const expectNoInjection = (el: HTMLElement) => {
  const nodes = [el, ...Array.from(el.querySelectorAll('*'))];
  expect(nodes.some((n) => n.localName === 'image')).toBe(false);
  expect(
    nodes.some((n) => Array.from(n.attributes).some((a) => a.name.toLowerCase().startsWith('on')))
  ).toBe(false);
};

describe('artistic text attributes cannot inject markup', () => {
  it('hostile font family', () => {
    expectNoInjection(paint(layerOf(slot('ok', { fontFamily: HOSTILE_FONT }))));
  });

  it('hostile layer id', () => {
    // The id only reaches the SVG on curved text (curve path) and gradient text (gradient id).
    expectNoInjection(paint(layerOf(slot(HOSTILE_ID, { curveAmount: 30, textGradientType: 'sunset-gold' }))));
  });

  it('hostile colour', () => {
    expectNoInjection(paint(layerOf(slot('ok', { fillColor: HOSTILE_COLOUR, outerStrokeColor: HOSTILE_COLOUR, outerStrokeWidth: 2 }))));
  });

  it('generateArtisticTextSvgString yields well-formed SVG for a font family with " and <', () => {
    const model = buildArtisticTextModelFromSlot({ width_px: 400, height_px: 200, font_size_px: 40, content: { es: 'Hola' }, style: { fontFamily: 'a"<b' } }, 'es');
    const doc = new DOMParser().parseFromString(generateArtisticTextSvgString(model, 'c'), 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(doc.getElementsByTagName('image').length).toBe(0);
  });
});
