/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The outline of a 2.0 shape: what clips its fill and carries its stroke. One
// function for every renderer that draws a shape in the DOM.

import { frameSilhouette, type FrameSilhouette } from "../frame-silhouette.js";
import { shapeDrawing } from "../geoShapes.js";
import type { Geometry } from "./schema.js";

export type Outline = {
  /** The figure to draw, or null for a box (a rectangle, or an ellipse drawn round). */
  silhouette: FrameSilhouette | null;
  /** A colour fill paints inside the figure; an open stroke does not take one. */
  fillable: boolean;
  /** An ellipse: the box with fully rounded corners. */
  round: boolean;
  /** The catalogue name, for the mask of a non-flat fill. */
  preset?: string;
  /** A single custom path (the frame of a photo or a blob), with its viewBox. */
  path?: { d: string; viewBox: string };
};

const BOX: Outline = { silhouette: null, fillable: true, round: false };

export function geometryOutline(geometry: Geometry | undefined): Outline {
  if (!geometry || geometry.kind === "rect") return BOX;
  if (geometry.kind === "line" || geometry.kind === "preset" || geometry.kind === "ellipse") {
    // 1.x drew its circle as the catalogue's `circle` path; the box is also rounded.
    const preset = geometry.kind === "line" ? "line" : geometry.kind === "ellipse" ? "circle" : geometry.name;
    const drawing = shapeDrawing(preset);
    if (!drawing) return BOX;
    return {
      silhouette: frameSilhouette({ geoShape: preset }),
      fillable: drawing.kind === "polygon" || !!drawing.fillable,
      round: geometry.kind === "ellipse",
      preset,
    };
  }
  if (geometry.kind === "paths" && geometry.paths.length === 1 && !geometry.paths[0].fill && !geometry.paths[0].stroke) {
    const viewBox = geometry.viewBox.join(" ");
    const silhouette = frameSilhouette({ svgPath: geometry.paths[0].d, svgViewBox: viewBox });
    // upgrade leaves out the colour 1.x did not paint inside a custom path, so whatever fill remains is drawn.
    return silhouette ? { silhouette, fillable: true, round: false, path: { d: silhouette.d!, viewBox: silhouette.viewBox } } : BOX;
  }
  // A drawing of several paths (an SVG) paints itself; polygon and star are not written by upgrade yet.
  return BOX;
}
