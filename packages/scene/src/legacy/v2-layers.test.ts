/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { typographyCss } from './v2-layers';

const text = (t: object) => ({ id: 't', type: 'text', box: { x: 0, y: 0 }, text: { content: { es: 'x' }, ...t } }) as never;

describe('typographyCss', () => {
  it('a size with per-language exceptions takes the one of the language', () => {
    const layer = text({ font: { size: { value: 40, modes: { de: 32 } } } });
    expect(typographyCss(layer, 'de')!.fontSize).toBe('32px');
    expect(typographyCss(layer, 'es')!.fontSize).toBe('40px');
  });

  it('every typography field becomes its CSS', () => {
    expect(typographyCss(text({ font: { family: 'Inter', weight: 700, italic: true }, letterSpacing: 2, transform: 'uppercase', decoration: 'underline', maxWidth: 400 }), 'es')).toEqual({
      fontFamily: 'Inter', fontWeight: '700', fontStyle: 'italic', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'underline', maxWidth: '400px',
    });
  });

  it('a layer that is not a text has no typography', () => {
    expect(typographyCss({ id: 's', type: 'shape' } as never, 'es')).toBeUndefined();
  });
});

describe('drawingLink and drawingSvg', () => {
  const lit = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const layer = (fills?: object[], strokes?: object[]) => ({ id: 'a', type: 'shape', box: { x: 0, y: 0 }, fills, strokes }) as never;
  const color = (value: string) => ({ kind: 'color', value });

  it('currentColor is the fill, else the stroke, and the other way round', async () => {
    const { drawingLink } = await import('./v2-layers');
    expect(drawingLink(layer([color('#f00')], [{ paint: color('#00f'), width: 0 }]), lit)).toEqual({ fill: '#f00', stroke: '#00f' });
    expect(drawingLink(layer(undefined, [{ paint: color('#00f'), width: 0 }]), lit)).toEqual({ fill: '#00f', stroke: '#00f' });
    expect(drawingLink(layer([color('#f00')]), lit)).toEqual({ fill: '#f00', stroke: '#f00' });
  });

  it('a tile writes literal attributes and its own size; inline goes through CSSOM', async () => {
    const { drawingSvg } = await import('./v2-layers');
    const g = { kind: 'paths', viewBox: [0, 0, 24, 24], paths: [{ d: 'M0 0H24', stroke: 'currentColor', strokeWidth: 2 }] } as never;
    const tile = drawingSvg(g, { stroke: '#a3e635' }, true);
    expect(tile).toContain('width="24"');
    expect(tile).toContain('stroke="#a3e635"');
    const inline = drawingSvg(g, { stroke: 'red; background-image: url(x)' });
    expect(inline).toContain('width="100%"');
    expect(inline).not.toContain('background-image');
  });
});
