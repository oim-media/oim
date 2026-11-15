/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ImageBlock, Layer, Paint } from "./schema.js";

/** The picture of the file itself: the player shows its base PNG, so an image layer never repaints it. */
const BASE = "oim:base";

/**
 * True when some image layer, nested ones included, shows the file's own picture (`oim:base`),
 * in its principal picture or in any language. Such a document's PNG is its base, not a poster.
 */
export function hasBaseLayer(document: { layers: Layer[]; resources?: Record<string, Paint> }): boolean {
  // A `{ ref }` is read through the resource it names, as resolveRefs would read it.
  const shows = (src: ImageBlock["src"]): boolean => {
    if (typeof src === "string") return src === BASE;
    if ("ref" in src) {
      const paint = document.resources?.[src.ref];
      return paint !== undefined && "kind" in paint && paint.kind === "image" && paint.src === BASE;
    }
    return src.value === BASE || Object.values(src.modes ?? {}).includes(BASE);
  };
  const walk = (layers: Layer[]): boolean =>
    layers.some((layer) => (layer.image !== undefined && shows(layer.image.src)) || walk(layer.children ?? []));
  return walk(document.layers);
}
