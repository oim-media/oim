/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The bridge of the migration: the renderer still walks the 1.x slots, and
// reads from the 2.0 layer of each one the blocks already moved to 2.0.
import { upgrade } from '../../../core/src/v2/upgrade.js';
import type { Box, Layer } from '../../../core/src/v2/schema.js';

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

/** How far a box moves, as CSS translate shares of its own size, so its anchor lands on x, y. */
export function anchorShift(box: Box): [string, string] {
  const anchor = box.anchor ?? 'top-left';
  const x = /left/.test(anchor) ? '0%' : /right/.test(anchor) ? '-100%' : '-50%';
  const y = /^top/.test(anchor) ? '0%' : /^bottom/.test(anchor) ? '-100%' : '-50%';
  return [x, y];
}
