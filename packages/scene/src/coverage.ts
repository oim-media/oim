/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What scene does not paint yet. Stage 6b.1 covers the static blocks; 6b.2 adds
// effects, masks, animation and time, modes, Lottie, artistic text, patterns,
// generative fills and textures. A vector that uses one of these is skipped by
// the visual gate, never failed, and the renderer ignores the block (with one
// development warning per block type).
import type { Layer, OimDocument, Paint } from "@oim-media/core/v2";

export const UNSUPPORTED_BLOCKS = [
  "animations",
  "effects",
  "figure:image",
  "interactions",
  "lottie",
  "mask",
  "motion",
  "paint:generative",
  "paint:pattern",
  "paint:texture",
  "image:filters",
  "layer:blend",
  "layer:opacity",
  "text:artistic",
  "text:dropCap",
  "text:decoration",
  "text:highlight",
  "text:marks",
  "text:runs",
] as const;
export type UnsupportedBlock = (typeof UNSUPPORTED_BLOCKS)[number];

const paintUses = (paints: readonly Paint[] | undefined): UnsupportedBlock[] =>
  (paints ?? []).flatMap((paint): UnsupportedBlock[] => {
    if (!("kind" in paint)) return [];
    if (paint.kind === "pattern") return ["paint:pattern"];
    if (paint.kind === "generative") return ["paint:generative"];
    if (paint.kind === "texture") return ["paint:texture"];
    return paint.kind === "image" && paint.filters ? ["image:filters"] : [];
  });

const layerUses = (layer: Layer): UnsupportedBlock[] => {
  const uses: UnsupportedBlock[] = [...paintUses(layer.fills), ...(layer.strokes ?? []).flatMap((s) => paintUses([s.paint as Paint]))];
  if (layer.type === "lottie") uses.push("lottie");
  if (layer.effects?.length) uses.push("effects");
  if (layer.animations?.length) uses.push("animations");
  if (layer.motion) uses.push("motion");
  if (layer.mask) uses.push("mask");
  if (layer.interactions?.length) uses.push("interactions");
  if (layer.image?.filters) uses.push("image:filters");
  if (layer.opacity !== undefined && layer.opacity !== 1) uses.push("layer:opacity");
  if (layer.blend) uses.push("layer:blend");
  // A picture on a figure (a star, a cloud, a path) is not drawn yet: only a box takes one.
  if (layer.geometry && layer.geometry.kind !== "rect" && (layer.fills ?? []).some((p) => "kind" in p && p.kind === "image")) uses.push("figure:image");
  const text = layer.text;
  if (text) {
    if (text.artistic) uses.push("text:artistic");
    if (text.dropCap) uses.push("text:dropCap");
    if (text.decoration) uses.push("text:decoration");
    if (text.highlight) uses.push("text:highlight");
    if (text.marks) uses.push("text:marks");
    if (text.runs) uses.push("text:runs");
  }
  for (const child of layer.children ?? []) uses.push(...layerUses(child));
  return uses;
};

/** The out-of-scope blocks a document uses, each once, sorted. Run it on a document whose references are resolved. */
export function unsupportedUse(document: OimDocument): UnsupportedBlock[] {
  const uses = [...paintUses(document.canvas.fills), ...document.layers.flatMap(layerUses)];
  return [...new Set(uses)].sort();
}
