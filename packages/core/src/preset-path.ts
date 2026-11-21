/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A catalogue preset as a path in the pixels of its box.
 *
 * CANONICAL: the only place a preset becomes a path. The shape fills its box (no
 * inset), and the shapes that have a radius are built from the real width and
 * height, as CSS `border-radius` does, so their curves are never stretched.
 * The other presets keep the drawing in `GEO_SHAPES`, normalised so that its
 * bounding box is the box.
 */

import { GEO_SHAPES } from "./geoShapes.js";
import { normalizePathData, transformPathData } from "./path-data.js";

export interface PresetPath {
  d: string;
  /** Always `0 0 width height`: the path is already in pixels, nothing is stretched. */
  viewBox: string;
}

const pts = (...v: number[]) => v.map((x) => Math.round(x * 100) / 100).join(" ");
/** A quarter-circle arc of radius `r` ending at (x, y), clockwise. */
const arc = (r: number, x: number, y: number) => `A${pts(r, r, 0, 0, 1, x, y)}`;

/** A rounded rectangle; `top` and `bottom` are the radii of the upper and lower corners, `tail` an optional detour along the bottom edge. */
function rrect(w: number, h: number, top: number, bottom: number, tail = ""): string {
  return (
    `M${pts(top, 0)}L${pts(w - top, 0)}${arc(top, w, top)}L${pts(w, h - bottom)}${arc(bottom, w - bottom, h)}${tail}` +
    `L${pts(bottom, h)}${arc(bottom, 0, h - bottom)}L${pts(0, top)}${arc(top, top, 0)}Z`
  );
}

/** Body 67/88 of the height, then a tail down to the bottom edge: the 1.x proportions. */
function bubble(w: number, h: number): string {
  const body = (h * 67) / 88;
  const x = (u: number) => (w * (u - 5)) / 90;
  const tail = `L${pts(x(42), body)}L${pts(x(22), h)}L${pts(x(28), body)}`;
  const r = 0.15 * Math.min(w, h); // never above half the body: 0.15 < 0.38
  return rrect(w, body, r, r, tail);
}

const ellipse = (w: number, h: number) => `M${pts(0, h / 2)}A${pts(w / 2, h / 2, 0, 1, 1, w, h / 2)}A${pts(w / 2, h / 2, 0, 1, 1, 0, h / 2)}Z`;

/** The bounding box of a path in the catalogue's 0-100 space. */
function boundsOf(d: string): [number, number, number, number] {
  // shortcut: curve extrema are sampled (64 steps), not solved; enough for a fixed catalogue.
  const xs: number[] = [];
  const ys: number[] = [];
  let cx = 0;
  let cy = 0;
  for (const { cmd, args } of normalizePathData(d) ?? []) {
    if (cmd === "Z") continue;
    if (cmd === "C") {
      for (let i = 1; i < 64; i++) {
        const t = i / 64;
        const u = 1 - t;
        xs.push(u ** 3 * cx + 3 * u * u * t * args[0] + 3 * u * t * t * args[2] + t ** 3 * args[4]);
        ys.push(u ** 3 * cy + 3 * u * u * t * args[1] + 3 * u * t * t * args[3] + t ** 3 * args[5]);
      }
    }
    cx = args[args.length - 2];
    cy = args[args.length - 1];
    xs.push(cx);
    ys.push(cy);
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** A preset as path data in a `width` x `height` box; null for the rectangle, an unknown name or an empty box. */
export function presetPath(name: string, width: number, height: number): PresetPath | null {
  if (!(width > 0) || !(height > 0)) return null;
  const viewBox = `0 0 ${width} ${height}`;
  const radius: Record<string, () => string> = {
    arch: () => rrect(width, height, Math.min(width / 2, height), 0),
    pill: () => rrect(width, height, Math.min(width, height) / 2, Math.min(width, height) / 2),
    bubble: () => bubble(width, height),
    circle: () => ellipse(width, height),
    line: () => `M${pts(0, height / 2)}L${pts(width, height / 2)}`,
  };
  if (radius[name]) return { d: radius[name](), viewBox };
  const drawing = GEO_SHAPES[name];
  if (!drawing) return null;
  const source = drawing.kind === "polygon" ? `M${drawing.points.map((p) => p.join(",")).join("L")}Z` : drawing.d;
  const [x0, y0, x1, y1] = boundsOf(source);
  const d = transformPathData(source, (x, y) => [((x - x0) * width) / (x1 - x0), ((y - y0) * height) / (y1 - y0)]);
  return d ? { d, viewBox } : null;
}
