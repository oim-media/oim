/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getMaskClipPathD,
  getMaskSilhouetteCanvasD,
  getMaskSilhouettePath,
  getWindowMaskCanvasD,
} from "./layerComposition";

/**
 * The player draws every mask silhouette from the shared catalogue in core
 * (maskOutlinePath). A literal copy of the table here drifted once: the editor
 * gained triangle, line, arrow and diamond, the player did not, and a triangular
 * mask came out as a circle. The lookup must never fall back silently.
 */
const FIGURAS_ESPERADAS = [
  "circle",
  "rectangle",
  "triangle",
  "star",
  "line",
  "arrow",
  "diamond",
  "hexagon",
  "heart",
  "blob",
];

const FULL_CANVAS = { width: 100, height: 100 };

function maskOf(style: Record<string, unknown>) {
  return { id: "m", type: "mask", x: 0, y: 0, width: 100, height: 100, style } as any;
}

describe("mask silhouettes come from the shared catalogue", () => {
  it("the player has no literal shape table left", () => {
    const src = readFileSync(join(__dirname, "layerComposition.ts"), "utf8");
    expect(src).not.toMatch(/MASK_SHAPE_PATHS|function scalePath/);
  });

  it("draws every silhouette the editor offers, as a closed path", () => {
    for (const figureItem of FIGURAS_ESPERADAS) {
      const d = getMaskSilhouetteCanvasD(maskOf({ maskShape: figureItem }), FULL_CANVAS);
      expect(d, `falta la silueta "${figureItem}"`).not.toBeNull();
      expect(d!.startsWith("M"), `"${figureItem}" does not start with M`).toBe(true);
    }
  });

  it("an unknown shape falls back to the layer's box, never to a circle", () => {
    expect(getMaskSilhouetteCanvasD(maskOf({ maskShape: "nope" }), FULL_CANVAS)).toBe("M0 0H100V100H0Z");
  });
});

/** Points of a path as [x, y] pairs, in the order they are written. */
function pointsOf(d: string): [number, number][] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

describe("mask outlines keep their geometry inside the box", () => {
  // Box at (40, 20), 50 wide and 30 high, on a 200 x 200 canvas: a catalogue unit maps to x = 40 + u/2, y = 20 + 0.3v.
  // Not square on purpose: a square box cannot tell an x scale from a y scale.
  const canvas = { width: 200, height: 200 };
  const slotAt = (style: Record<string, unknown>) =>
    ({ id: "m", type: "mask", x: 40, y: 20, width: 50, height: 30, style } as any);
  const outlineOf = (style: Record<string, unknown>) => getMaskSilhouetteCanvasD(slotAt(style), canvas)!;
  const xsOf = (d: string) => pointsOf(d).map(([x]) => x);
  const ysOf = (d: string) => pointsOf(d).map(([, y]) => y);
  const hasPoint = (d: string, x: number, y: number) =>
    pointsOf(d).some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6);

  it("triangle: apex at the top middle, base on the bottom edge", () => {
    const d = outlineOf({ maskShape: "triangle" });
    expect(Math.min(...xsOf(d))).toBeCloseTo(42.5, 6);
    expect(Math.max(...xsOf(d))).toBeCloseTo(87.5, 6);
    expect(Math.min(...ysOf(d))).toBeCloseTo(21.5, 6);
    expect(Math.max(...ysOf(d))).toBeCloseTo(47, 6);
    expect(hasPoint(d, 65, 21.5)).toBe(true);
  });

  it("diamond: the right vertex sits on the middle row of the box", () => {
    const d = outlineOf({ maskShape: "diamond" });
    expect(Math.min(...xsOf(d))).toBeCloseTo(42.5, 6);
    expect(Math.max(...xsOf(d))).toBeCloseTo(87.5, 6);
    expect(Math.min(...ysOf(d))).toBeCloseTo(21.5, 6);
    expect(Math.max(...ysOf(d))).toBeCloseTo(48.5, 6);
    expect(hasPoint(d, 87.5, 35)).toBe(true);
  });

  it("star: spans the full width of the box and has an inner vertex", () => {
    const d = outlineOf({ maskShape: "star" });
    expect(Math.min(...xsOf(d))).toBeCloseTo(40, 6);
    expect(Math.max(...xsOf(d))).toBeCloseTo(90, 6);
    expect(Math.min(...ysOf(d))).toBeCloseTo(20.6, 6);
    expect(Math.max(...ysOf(d))).toBeCloseTo(48.5, 6);
    expect(hasPoint(d, 71, 31.4)).toBe(true);
  });

  it("an absolute Q path is fitted into the box, control points included", () => {
    const d = outlineOf({ maskSvgPath: "M0 0 Q50 100 100 0 Z" });
    expect(Math.min(...xsOf(d))).toBeCloseTo(40, 6);
    expect(Math.max(...xsOf(d))).toBeCloseTo(90, 6);
    expect(Math.min(...ysOf(d))).toBeCloseTo(20, 6);
    // The quadratic control point (y = 100) becomes two cubic controls at y = 66.7, i.e. 40 on the canvas.
    expect(Math.max(...ysOf(d))).toBeCloseTo(40, 6);
  });
});

describe("a mask whose outline cannot be drawn falls back to its box", () => {
  const canvas = { width: 200, height: 200 };
  const slotWith = (style: Record<string, unknown>) =>
    ({ id: "m", type: "mask", x: 40, y: 20, width: 50, height: 50, style } as any);
  const box = "M40 20H90V70H40Z";

  it.each([
    ["custom without a path", { maskShape: "custom" }],
    ["an unknown name", { maskShape: "nope" }],
    ["a path that is not a path", { maskSvgPath: "M0 0 X9 9" }],
  ])("%s: the silhouette is the box", (_label, style) => {
    expect(getMaskSilhouetteCanvasD(slotWith(style), canvas)).toBe(box);
    expect(getMaskSilhouettePath(slotWith(style))).toBe("M0 0H100V100H0Z");
  });

  it("a window frame keeps a rectangular hole the size of the box", () => {
    expect(getWindowMaskCanvasD(slotWith({ maskMode: "window", maskShape: "nope" }), canvas))
      .toBe(`M0 0H200V200H0Z ${box}`);
  });

  it("a cutout clips to the box, so the layer below is not dropped", () => {
    expect(getMaskClipPathD(slotWith({ maskMode: "cutout", maskShape: "nope" }), canvas))
      .toBe(`M0 0H200V200H0Z ${box} ${box}`);
  });
});
