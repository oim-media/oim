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
import type { Effect, Layer, OimDocument, Paint } from "@oim-media/core/v2";

export const UNSUPPORTED_BLOCKS = [
  "animations",
  "effect:color-grade",
  "effect:duotone",
  "effect:filter",
  "effect:texture",
  "interactions",
  "lottie",
  "mask",
  "motion",
  "paint:generative",
  "paint:pattern-tile",
  "paint:texture",
  "text:dropCap",
  "text:decoration",
  "text:highlight",
  "text:marks",
] as const;
export type UnsupportedBlock = (typeof UNSUPPORTED_BLOCKS)[number];

const paintUses = (paints: readonly Paint[] | undefined): UnsupportedBlock[] =>
  (paints ?? []).flatMap((paint): UnsupportedBlock[] => {
    if (!("kind" in paint)) return [];
    if (paint.kind === "generative") return ["paint:generative"];
    if (paint.kind === "texture") return ["paint:texture"];
    return [];
  });

/** The effects scene paints are blur, shadow, glow and backdrop; a duotone is a backdrop's preset. */
const effectUses = (fx: Effect): UnsupportedBlock[] => {
  if (fx.kind === "color-grade" || fx.kind === "filter" || fx.kind === "texture") return [`effect:${fx.kind}`];
  return fx.kind === "backdrop" && fx.preset === "duotone" ? ["effect:duotone"] : [];
};

const layerUses = (layer: Layer): UnsupportedBlock[] => {
  const uses: UnsupportedBlock[] = [...paintUses(layer.fills), ...(layer.strokes ?? []).flatMap((s) => paintUses([s.paint as Paint]))];
  if (layer.type === "lottie") uses.push("lottie");
  // 1.x tiled a background slot's own drawing; 2.0 has no field for a drawn tile yet, so the upgrade leaves it as paths.
  if (layer.geometry?.kind === "paths" && (layer.fills ?? []).some((p) => "kind" in p && p.kind === "pattern")) uses.push("paint:pattern-tile");
  for (const fx of layer.effects ?? []) uses.push(...effectUses(fx));
  if (layer.animations?.length) uses.push("animations");
  if (layer.motion) uses.push("motion");
  // A window mask is painted; a cutout (it clips the layers under it) is not yet.
  if (layer.mask?.mode === "cutout") uses.push("mask");
  if (layer.interactions?.length) uses.push("interactions");
  const text = layer.text;
  if (text) {
    if (text.dropCap) uses.push("text:dropCap");
    if (text.decoration) uses.push("text:decoration");
    if (text.highlight) uses.push("text:highlight");
    if (text.marks) uses.push("text:marks");
  }
  for (const child of layer.children ?? []) uses.push(...layerUses(child));
  return uses;
};

/** The out-of-scope blocks a document uses, each once, sorted. Run it on a document whose references are resolved. */
export function unsupportedUse(document: OimDocument): UnsupportedBlock[] {
  const uses = [...paintUses(document.canvas.fills), ...document.layers.flatMap(layerUses)];
  return [...new Set(uses)].sort();
}
