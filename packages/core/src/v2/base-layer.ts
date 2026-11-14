/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ImageBlock, Layer } from "./schema.js";

/** The picture of the file itself: the player shows its base PNG, so an image layer never repaints it. */
const BASE = "oim:base";

/**
 * True when some image layer, nested ones included, shows the file's own picture (`oim:base`),
 * in its principal picture or in any language. Such a document's PNG is its base, not a poster.
 */
export function hasBaseLayer(document: { layers: Layer[] }): boolean {
  const shows = (src: ImageBlock["src"]): boolean =>
    typeof src === "string" ? src === BASE : src.value === BASE || Object.values(src.modes ?? {}).includes(BASE);
  const walk = (layers: Layer[]): boolean =>
    layers.some((layer) => (layer.image !== undefined && shows(layer.image.src)) || walk(layer.children ?? []));
  return walk(document.layers);
}
