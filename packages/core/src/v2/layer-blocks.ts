/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Which block each layer type admits. The single source of truth for the 2.0
// document: the schema builds each layer object from this table, so a block on
// a type that does not admit it is a validation error rather than ignored data.

export const LAYER_TYPES = ["text", "shape", "image", "lottie", "group"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export const BLOCKS = [
  "fills",
  "strokes",
  "effects",
  "animations",
  "motion",
  "mask",
  "geometry",
  "corners",
  "text",
  "image",
  "a11y",
  "interaction",
  "children",
] as const;
export type Block = (typeof BLOCKS)[number];

export const LAYER_BLOCKS: Record<LayerType, readonly Block[]> = {
  text: ["fills", "strokes", "effects", "animations", "motion", "mask", "text", "interaction"],
  shape: ["fills", "strokes", "effects", "animations", "motion", "mask", "geometry", "corners", "a11y", "interaction"],
  image: ["strokes", "effects", "animations", "motion", "mask", "corners", "image", "a11y", "interaction"],
  lottie: ["effects", "animations", "motion"],
  group: ["effects", "animations", "motion", "interaction", "children"],
};

export function admits(type: LayerType, block: Block): boolean {
  return LAYER_BLOCKS[type].includes(block);
}
