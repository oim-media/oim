/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The outline of a photo frame: the shape that clips the photo and draws the
 * stroke. The player and the editor both ask here, so they agree.
 *
 * The blob fallback chain is the one `ImageEngine.ts` painted:
 * `customBlobPath`, then `svgPath`, then the catalogue. An `||` never leaves
 * the canvas empty.
 */

import { shapeDrawing } from "./geoShapes.js";

/** Path data only: no markup, quotes or url(). The same pattern as `svgPath` in the schema. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;
/** Four numbers, as an SVG viewBox. */
const VIEW_BOX = /^-?\d+(\.\d+)?([\s,]+-?\d+(\.\d+)?){3}$/;
const DEFAULT_VIEW_BOX = "0 0 100 100";

// Readers may skip schema validation: every string that reaches an attribute is
// re-checked here, and anything that is not path data is dropped.
const path = (d?: string) => (d && d.length <= 20000 && PATH_DATA.test(d) ? d : undefined);
const viewBox = (v?: string) => (v && v.length <= 64 && VIEW_BOX.test(v) ? v : DEFAULT_VIEW_BOX);

/** The twelve shapes that arrived with 1.19.0: an older reader does not know them. */
const SHAPES_1_19 = [
  "pill", "octagon", "pentagon", "cross", "moon", "cloud", "drop",
  "bolt", "bubble", "flower", "burst", "arch",
];

export interface FrameSilhouette {
  d?: string;
  points?: string;
  viewBox: string;
}

export interface FrameStyle {
  geoShape?: string;
  svgPath?: string;
  svgViewBox?: string;
  customBlobPath?: string;
}

/**
 * A frame's outline, or `null` for a rectangle (drawn from its width and
 * height, no outline) or an unknown shape.
 */
export function frameSilhouette(style: FrameStyle): FrameSilhouette | null {
  const drawing = shapeDrawing(style.geoShape);
  const svgPath = path(style.svgPath);
  if (!drawing) {
    // An svgPath with no catalogue shape is a custom frame: always fillable.
    if (!svgPath) return null;
    return { d: svgPath, viewBox: viewBox(style.svgViewBox) };
  }
  if (drawing.tipo === "polygon") {
    return { points: drawing.puntos.map(([x, y]) => `${x},${y}`).join(" "), viewBox: DEFAULT_VIEW_BOX };
  }
  // The blob and the scribble take their own path; the blob also an svgPath.
  const isGenerative = style.geoShape === "blob" || style.geoShape === "scribble";
  const d = (isGenerative && path(style.customBlobPath))
    || (style.geoShape === "blob" && svgPath)
    || drawing.d;
  return { d, viewBox: DEFAULT_VIEW_BOX };
}

/**
 * Does this slot need the `frame_shapes` capability (1.19.0)? A reader without
 * it paints the rectangle with the whole photo, so the .oim must say so.
 */
export function usesFrameShapes(slot: {
  type?: string;
  geoShape?: string;
  svgPath?: string;
  fillType?: string;
  fillImageFlipX?: boolean;
  fillImageFlipY?: boolean;
}): boolean {
  if (slot.type !== "geo") return false;
  if (slot.geoShape && SHAPES_1_19.includes(slot.geoShape)) return true;
  if (slot.svgPath && slot.fillType === "image") return true;
  return slot.fillType === "image" && (!!slot.fillImageFlipX || !!slot.fillImageFlipY);
}
