/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The clip of a filter layer: a rectangle with corner radii by default, or a catalogue
 * shape. CANONICAL: the editor, the player and the export call this one function.
 */

import { maskOutlinePath, type MaskBox } from "./mask-outline.js";

export interface FilterClipInput {
  geoShape?: string;
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
}

/** Open strokes cannot clip: a filter needs a surface. The schema rejects them too. */
const OPEN_STROKES = new Set(["line", "scribble"]);

/** The Bezier constant for a quarter circle. */
const KAPPA = 0.5523;

/** min(r, w/2, h/2): the same cut the editor makes. A non-finite radius counts as 0. */
export function clampRadius(r: number, width: number, height: number): number {
  const safe = Number.isFinite(r) ? r : 0;
  return Math.max(0, Math.min(safe, width / 2, height / 2));
}

function roundedRectPath(box: MaskBox, [tl, tr, br, bl]: number[]): string {
  const { x, y, width: w, height: h } = box;
  const k = KAPPA;
  return [
    `M${x + tl} ${y}`,
    `L${x + w - tr} ${y}`,
    `C${x + w - tr + k * tr} ${y} ${x + w} ${y + tr - k * tr} ${x + w} ${y + tr}`,
    `L${x + w} ${y + h - br}`,
    `C${x + w} ${y + h - br + k * br} ${x + w - br + k * br} ${y + h} ${x + w - br} ${y + h}`,
    `L${x + bl} ${y + h}`,
    `C${x + bl - k * bl} ${y + h} ${x} ${y + h - bl + k * bl} ${x} ${y + h - bl}`,
    `L${x} ${y + tl}`,
    `C${x} ${y + tl - k * tl} ${x + tl - k * tl} ${y} ${x + tl} ${y}`,
    "Z",
  ].join(" ");
}

/**
 * Silhouette of the filter clip in canvas coordinates inside `box`. The rectangle (default)
 * takes the corner radii; circle and the other frame shapes come from `maskOutlinePath`.
 * Returns null when there is no shape clip: a line or scribble, or an unknown name.
 */
export function filterClipPath(input: FilterClipInput, box: MaskBox): string | null {
  const name = input.geoShape;
  if (!name || name === "rect" || name === "rectangle") {
    const radii = [
      input.borderRadiusTopLeft ?? 0,
      input.borderRadiusTopRight ?? 0,
      input.borderRadiusBottomRight ?? 0,
      input.borderRadiusBottomLeft ?? 0,
    ].map((r) => clampRadius(r, box.width, box.height));
    return roundedRectPath(box, radii);
  }
  if (OPEN_STROKES.has(name)) return null;
  return maskOutlinePath({ geoShape: name }, box);
}
