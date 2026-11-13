/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The bridge of the migration: the renderer still walks the 1.x slots, and
// reads from the 2.0 layer of each one the blocks already moved to 2.0.
import { upgrade } from '../../../core/src/v2/upgrade.js';
import type { Box, Layer } from '../../../core/src/v2/schema.js';
import type { PaintColors } from '../../../core/src/v2/paint-css.js';
import { resolveCssColor, resolvePalette } from '../../../core/src/dynamic-colors.js';

const cache = new WeakMap<object, Map<string, Layer>>();

/** Every layer of the document as 2.0, by id, nested ones included. Computed once per metadata object. */
export function v2LayersOf(metadata: object): Map<string, Layer> {
  let layers = cache.get(metadata);
  if (layers) return layers;
  layers = new Map();
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      layers!.set(layer.id, layer);
      walk(layer.children ?? []);
    }
  };
  walk(upgrade(metadata).document.layers);
  cache.set(metadata, layers);
  return layers;
}

/**
 * How the renderer paints a 2.0 colour: a palette binding stays a `var()` so a
 * mode change needs no repaint; drawn-in paints (patterns) take the default
 * palette's value, since an image cannot hold a `var()`.
 */
export function paintColors(metadata: { palettes?: Record<string, Record<string, string>>; defaultPalette?: string }): PaintColors {
  const isVar = (v: unknown): v is { var: string; fallback?: string } => !!v && typeof v === 'object' && typeof (v as { var?: unknown }).var === 'string';
  return {
    css: (v) => (isVar(v) ? resolveCssColor(v.var, v.fallback) : typeof v === 'string' ? resolveCssColor(null, v) : '') || undefined,
    literal: (v) => (isVar(v)
      ? (resolvePalette(metadata)?.colors as Record<string, string> | undefined)?.[v.var] ?? resolveCssColor(null, v.fallback)
      : typeof v === 'string' ? resolveCssColor(null, v) : '') || undefined,
  };
}

/** How far a box moves, as CSS translate shares of its own size, so its anchor lands on x, y. */
export function anchorShift(box: Box): [string, string] {
  const anchor = box.anchor ?? 'top-left';
  const x = /left/.test(anchor) ? '0%' : /right/.test(anchor) ? '-100%' : '-50%';
  const y = /^top/.test(anchor) ? '0%' : /^bottom/.test(anchor) ? '-100%' : '-50%';
  return [x, y];
}
