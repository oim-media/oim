/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

describe('drawingLink and drawingSvg', () => {
  const lit = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const layer = (fills?: object[], strokes?: object[]) => ({ id: 'a', type: 'shape', box: { x: 0, y: 0 }, fills, strokes }) as never;
  const color = (value: string) => ({ kind: 'color', value });

  it('currentColor is the fill, else the stroke, and the other way round', async () => {
    const { drawingLink } = await import('./drawing');
    expect(drawingLink(layer([color('#f00')], [{ paint: color('#00f'), width: 0 }]), lit)).toEqual({ fill: '#f00', stroke: '#00f' });
    expect(drawingLink(layer(undefined, [{ paint: color('#00f'), width: 0 }]), lit)).toEqual({ fill: '#00f', stroke: '#00f' });
    expect(drawingLink(layer([color('#f00')]), lit)).toEqual({ fill: '#f00', stroke: '#f00' });
  });

  it('a gradient stroke paints every path with one gradient across the viewBox, as the editor', async () => {
    const { drawingLink, drawingSvg } = await import('./drawing');
    const gradient = { type: 'linear', angle: 180, stops: [{ color: '#7D03FC', at: 0 }, { color: '#2563EB', at: 1 }] };
    const link = drawingLink(layer(undefined, [{ paint: { kind: 'gradient', gradient }, width: 0 }]), lit);
    const g = { kind: 'paths', viewBox: [0, 0, 24, 24], paths: [{ d: 'M0 0H24', stroke: 'currentColor' }, { d: 'M0 4H24', fill: '#000' }] } as never;
    const host = document.createElement('div');
    host.innerHTML = drawingSvg(g, link);
    const grad = host.querySelector('linearGradient')!;
    expect([grad.getAttribute('x1'), grad.getAttribute('y1'), grad.getAttribute('x2'), grad.getAttribute('y2')]).toEqual(['12', '0', '12', '24']);
    expect(grad.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect([...grad.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color'))).toEqual(['#7D03FC', '#2563EB']);
    const paths = [...host.querySelectorAll('path')];
    for (const p of paths) expect(p.style.getPropertyValue('stroke')).toBe(`url(#${grad.id})`);
  });

  it('a tile writes literal attributes and its own size; inline goes through CSSOM', async () => {
    const { drawingSvg } = await import('./drawing');
    const g = { kind: 'paths', viewBox: [0, 0, 24, 24], paths: [{ d: 'M0 0H24', stroke: 'currentColor', strokeWidth: 2 }] } as never;
    const tile = drawingSvg(g, { stroke: '#a3e635' }, true);
    expect(tile).toContain('width="24"');
    expect(tile).toContain('stroke="#a3e635"');
    const inline = drawingSvg(g, { stroke: 'red; background-image: url(x)' });
    expect(inline).toContain('width="100%"');
    expect(inline).not.toContain('background-image');
  });
});
