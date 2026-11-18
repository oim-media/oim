/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 *
 * Duotone interpolation and window placement, pinned as they must be.
 *
 * The duotone filter maps luminance through a two-stop table (DUOTONE_COLORS,
 * the same table the editor draws). Without color-interpolation-filters the
 * SVG filter runs in linearRGB, so the table values are read as linear light and
 * come out brighter than the table: a blue channel that must stay between 36 and 75
 * came out at 145.
 */

import { describe, it, expect } from 'vitest';
import { buildLayerCompositionDefs } from './renderer';
import { upgrade } from '../runtime/upgrade-entry.js';

const artboard = { width: 800, height: 600 };

const duotoneSlot = {
  id: 'f3',
  type: 'filter',
  style: {},
  duotone: true,
  position: [20, 20],
  width_px: 400,
  height_px: 300,
} as any;

describe('duotone filter', () => {
  it('interpolates in sRGB like the editor table', () => {
    const svg = buildLayerCompositionDefs([duotoneSlot], artboard);
    expect(svg.outerHTML).toMatch(/<filter[^>]*color-interpolation-filters="sRGB"/);
  });
});

describe('window placement', () => {
  // A canonical 2.0 upgrade keeps the declared position: the frame's top is the
  // declared y, with no vertical offset. The harness documents use top-level
  // width/height, which the upgrade does not read as the artboard height; see the PR.
  it('a canonical document keeps the declared y of a window mask', () => {
    const result = upgrade({
      version: '1.30.2',
      artboardWidth: 800,
      artboardHeight: 600,
      slots: [
        {
          id: 'm1',
          type: 'mask',
          position: [25, 20],
          width_px: 300,
          height_px: 300,
          align: 'left',
          style: { maskMode: 'window', maskShape: 'heart' },
        },
      ],
    } as any);
    const mask = (result.document as any).layers.find((l: any) => l.id === 'm1');
    expect(mask.box.y).toBe(120);
  });
});
