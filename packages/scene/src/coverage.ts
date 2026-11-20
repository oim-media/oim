/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What scene does not paint yet. Stage 6b.1 covers the static blocks; 6b.2 adds
// the effects that need an SVG or an overlay (grain, texture, duotone), masks,
// animation and time, modes, Lottie, artistic text, patterns, generative fills
// and textures. A vector that uses one of these is skipped by
// the visual gate, never failed, and the renderer ignores the block (with one
// development warning per block type).
import type { Layer, OimDocument } from "@oim-media/core/v2";
import { canAnimate } from "./blocks/animations.js";

export const UNSUPPORTED_BLOCKS = [
  "animation:preset",
  "paint:pattern-tile",
] as const;
export type UnsupportedBlock = (typeof UNSUPPORTED_BLOCKS)[number];

const layerUses = (layer: Layer): UnsupportedBlock[] => {
  const uses: UnsupportedBlock[] = [];
  // Tracks and the reveal presets run; the named loops, hovers and text entrances wait for their painter.
  if (layer.animations?.some((a) => !canAnimate(a))) uses.push("animation:preset");
  // shortcut: a draft 2.0 file kept a background's drawing as its paths, which cannot be told from an icon cut to its
  // paths; both wait until the vectors carry `pattern.tile` (re-signed), then this rule goes.
  if (layer.geometry?.kind === "paths" && (layer.fills ?? []).some((p) => "kind" in p && p.kind === "pattern")) uses.push("paint:pattern-tile");
  for (const child of layer.children ?? []) uses.push(...layerUses(child));
  return uses;
};

/** The out-of-scope blocks a document uses, each once, sorted. Run it on a document whose references are resolved. */
export function unsupportedUse(document: OimDocument): UnsupportedBlock[] {
  const uses = document.layers.flatMap((layer) => layerUses(layer));
  return [...new Set(uses)].sort();
}
