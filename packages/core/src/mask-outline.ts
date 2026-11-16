/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The silhouette a mask cuts with, placed in a box on the canvas.
 *
 * CANONICAL: the editor and the player both draw masks through this function.
 * It reads the catalogue in geoShapes.ts, so a mask can take any catalogue shape.
 */

import { shapeDrawing, type ShapeDrawing } from "./geoShapes.js";
import { transformPathData } from "./path-data.js";

export interface MaskBox { x: number; y: number; width: number; height: number }
export interface MaskOutlineInput { geoShape?: string; svgPath?: string; svgViewBox?: string }

/** The catalogue lives in a 0-100 space. */
const CATALOGUE_VIEWBOX: [number, number, number, number] = [0, 0, 100, 100];

/** A line is a stroke, but as a mask it must cut a surface or it would cut nothing. */
const LINE_SURFACE: ShapeDrawing = { kind: "polygon", points: [[5, 45], [95, 45], [95, 55], [5, 55]] };

/** Open strokes other than the line (the scribble) are closed so they enclose an area. */
function surfaceOf(name: string, drawing: ShapeDrawing): ShapeDrawing {
  if (name === "line") return LINE_SURFACE;
  if (drawing.kind === "path" && !drawing.fillable) return { ...drawing, d: `${drawing.d} Z`, fillable: true };
  return drawing;
}

function parseViewBox(raw: string | undefined): [number, number, number, number] | null {
  if (raw === undefined) return CATALOGUE_VIEWBOX;
  const nums = raw.trim().split(/[\s,]+/).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  const [, , w, h] = nums;
  if (w <= 0 || h <= 0) return null;
  return nums as [number, number, number, number];
}

/** Maps path data from a viewBox into the box, or null when the data is not a path. */
function fitToBox(d: string, [vx, vy, vw, vh]: [number, number, number, number], box: MaskBox): string | null {
  return transformPathData(d, (x, y) => [
    box.x + ((x - vx) / vw) * box.width,
    box.y + ((y - vy) / vh) * box.height,
  ]);
}

/**
 * Silhouette in canvas coordinates inside `box`. Returns null when the name is not in
 * the catalogue and there is no svgPath: it never falls back to a circle.
 */
export function maskOutlinePath(input: MaskOutlineInput, box: MaskBox): string | null {
  const name = input.geoShape;
  const drawing = shapeDrawing(name);
  if (name && drawing) {
    const surface = surfaceOf(name, drawing);
    const d = surface.kind === "polygon"
      ? surface.points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ") + " Z"
      : surface.d;
    return fitToBox(d, CATALOGUE_VIEWBOX, box);
  }
  if (input.svgPath) {
    const viewBox = parseViewBox(input.svgViewBox);
    return viewBox ? fitToBox(input.svgPath, viewBox, box) : null;
  }
  return null;
}
