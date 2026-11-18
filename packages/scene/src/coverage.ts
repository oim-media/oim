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
import { canAnimate } from "./blocks/animations.js";

export const UNSUPPORTED_BLOCKS = [
  "animation:preset",
  "effect:color-grade",
  "effect:filter",
  "lottie",
  "mask",
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
    if (paint.kind === "texture") return ["paint:texture"];
    return [];
  });

/** The effects scene paints are blur, shadow, glow and backdrop; a duotone is a backdrop's preset. */
const effectUses = (fx: Effect): UnsupportedBlock[] => {
  if (fx.kind === "color-grade" || fx.kind === "filter") return [`effect:${fx.kind}`];
  return [];
};

const layerUses = (layer: Layer, nested = false): UnsupportedBlock[] => {
  const uses: UnsupportedBlock[] = [...paintUses(layer.fills), ...(layer.strokes ?? []).flatMap((s) => paintUses([s.paint as Paint]))];
  if (layer.type === "lottie") uses.push("lottie");
  // Tracks and the reveal presets run; the named loops, hovers and text entrances wait for their painter.
  if (layer.animations?.some((a) => !canAnimate(a))) uses.push("animation:preset");
  // 1.x tiled a background slot's own drawing; 2.0 has no field for a drawn tile yet, so the upgrade leaves it as paths.
  if (layer.geometry?.kind === "paths" && (layer.fills ?? []).some((p) => "kind" in p && p.kind === "pattern")) uses.push("paint:pattern-tile");
  for (const fx of layer.effects ?? []) uses.push(...effectUses(fx));
  // A window mask is painted, and a cutout at the top level; a cutout inside a group is not yet.
  if (nested && layer.mask?.mode === "cutout") uses.push("mask");
  const text = layer.text;
  if (text) {
    if (text.dropCap) uses.push("text:dropCap");
    if (text.decoration) uses.push("text:decoration");
    if (text.highlight) uses.push("text:highlight");
    if (text.marks) uses.push("text:marks");
  }
  for (const child of layer.children ?? []) uses.push(...layerUses(child, true));
  return uses;
};

/** The out-of-scope blocks a document uses, each once, sorted. Run it on a document whose references are resolved. */
export function unsupportedUse(document: OimDocument): UnsupportedBlock[] {
  const uses = [...paintUses(document.canvas.fills), ...document.layers.flatMap((layer) => layerUses(layer))];
  return [...new Set(uses)].sort();
}
