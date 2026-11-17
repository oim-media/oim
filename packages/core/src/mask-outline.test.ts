/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES } from "./geoShapes";
import { maskOutlinePath } from "./mask-outline";

/** Every number in a path, read as x,y pairs. Valid for M, L, C and Z with absolute coordinates. */
const pairsOf = (d: string): [number, number][] => {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
};

const bboxOf = (pairs: [number, number][]) => ({
  minX: Math.min(...pairs.map(([x]) => x)),
  minY: Math.min(...pairs.map(([, y]) => y)),
  maxX: Math.max(...pairs.map(([x]) => x)),
  maxY: Math.max(...pairs.map(([, y]) => y)),
});

// Non-square and offset, so a swapped axis or a missing offset cannot pass by accident.
const box = { x: 10, y: 20, width: 200, height: 50 };
/** Catalogue shapes fill the content box 5..95 of their mask box; the line is a surface over the full 0-100 space. */
const toCanvas = (name: string, [x, y]: [number, number]): [number, number] =>
  name === "line"
    ? [box.x + (x / 100) * box.width, box.y + (y / 100) * box.height]
    : [box.x + ((x - 5) / 90) * box.width, box.y + ((y - 5) / 90) * box.height];

/**
 * Expected geometry per catalogue shape, in the 0-100 catalogue space.
 * `bbox` covers every coordinate in the outline, control points included.
 * `point` is one distinctive vertex or end point of the outline.
 * Values are read from GEO_SHAPES. The scribble's bbox is the cubic control hull of its
 * Q/T curves after conversion: the quadratic control points are not on the outline.
 */
const OUTLINE_GEOMETRY: Record<string, { bbox: [number, number, number, number]; point: [number, number] }> = {
  triangle: { bbox: [5, 5, 95, 90], point: [50, 5] },
  star: { bbox: [0, 2, 100, 95], point: [50, 2] },
  arrow: { bbox: [5, 20, 95, 80], point: [95, 50] },
  diamond: { bbox: [5, 5, 95, 95], point: [50, 5] },
  hexagon: { bbox: [5, 5, 95, 95], point: [95, 50] },
  circle: { bbox: [5, 5, 95, 95], point: [50, 5] },
  heart: { bbox: [-5, -2, 105, 88], point: [50, 88] },
  line: { bbox: [5, 45, 95, 55], point: [5, 45] },
  blob: { bbox: [10, 10, 92, 90], point: [90, 50] },
  scribble: { bbox: [5, 68 + 1 / 3, 95, 88], point: [5, 88] },
  pill: { bbox: [5, 25, 95, 75], point: [95, 50] },
  octagon: { bbox: [5, 5, 95, 95], point: [95, 30] },
  pentagon: { bbox: [5.3, 5, 94.7, 90], point: [50, 5] },
  cross: { bbox: [5, 5, 95, 95], point: [35, 5] },
  moon: { bbox: [5, 5, 50, 95], point: [5, 50] },
  cloud: { bbox: [5, 20, 97, 85], point: [25, 85] },
  drop: { bbox: [20, 5, 80, 95], point: [80, 65] },
  bolt: { bbox: [18, 5, 82, 95], point: [34, 95] },
  bubble: { bbox: [5, 5, 95, 93], point: [22, 93] },
  flower: { bbox: [2.5, 3.8, 97.5, 96.2], point: [95, 50] },
  burst: { bbox: [5, 5, 95, 95], point: [50, 95] },
  arch: { bbox: [5, 5, 95, 95], point: [5, 95] },
};

describe("maskOutlinePath", () => {
  it("has a geometry pin for every catalogue shape", () => {
    expect(Object.keys(OUTLINE_GEOMETRY).sort()).toEqual(Object.keys(GEO_SHAPES).sort());
  });

  it.each(Object.keys(OUTLINE_GEOMETRY))("%s has its catalogue bounding box and a distinctive point", (name) => {
    const d = maskOutlinePath({ geoShape: name }, box)!;
    expect(d).toBeTruthy();
    const pairs = pairsOf(d);
    const { bbox, point } = OUTLINE_GEOMETRY[name];
    const b = bboxOf(pairs);
    const [x0, y0] = toCanvas(name, [bbox[0], bbox[1]]);
    const [x1, y1] = toCanvas(name, [bbox[2], bbox[3]]);
    expect(b.minX).toBeCloseTo(x0, 2);
    expect(b.minY).toBeCloseTo(y0, 2);
    expect(b.maxX).toBeCloseTo(x1, 2);
    expect(b.maxY).toBeCloseTo(y1, 2);
    // The path is written to two decimals, so compare within 0.01 rather than exactly.
    const [px, py] = toCanvas(name, point);
    expect(pairs.some(([x, y]) => Math.abs(x - px) < 0.01 && Math.abs(y - py) < 0.01)).toBe(true);
  });

  it("a circle mask touches the edges of its box, not a 5% inset", () => {
    // The catalogue draws a circle at 5..95; the mask box must hold the circle's full extent.
    const d = maskOutlinePath({ geoShape: "circle" }, { x: 200, y: 120, width: 300, height: 200 })!;
    const b = bboxOf(pairsOf(d));
    expect(b.minX).toBeCloseTo(200, 2);
    expect(b.maxX).toBeCloseTo(500, 2);
    expect(b.minY).toBeCloseTo(120, 2);
    expect(b.maxY).toBeCloseTo(320, 2);
  });

  it("returns null for an unknown name, never a circle", () => {
    expect(maskOutlinePath({ geoShape: "nope" }, box)).toBeNull();
  });

  it("fits the box: min x, max x, min y and max y land on the box edges", () => {
    // Arch spans 5-95 in the catalogue, the content box, so its edges land on the box edges.
    const d = maskOutlinePath({ geoShape: "arch" }, { x: 50, y: 20, width: 40, height: 10 })!;
    const b = bboxOf(pairsOf(d));
    expect(b.minX).toBeCloseTo(50, 2);
    expect(b.maxX).toBeCloseTo(90, 2);
    expect(b.minY).toBeCloseTo(20, 2);
    expect(b.maxY).toBeCloseTo(30, 2);
  });

  it("converts a polygon to a closed path scaled to the box", () => {
    // Diamond 5..95 in the catalogue, placed in a 200x100 box offset by (10,0): its vertices sit on the box edges.
    expect(maskOutlinePath({ geoShape: "diamond" }, { x: 10, y: 0, width: 200, height: 100 })).toBe(
      "M110 0L210 50L110 100L10 50Z",
    );
  });

  it("gives line its surface band, not its zero-area stroke", () => {
    expect(maskOutlinePath({ geoShape: "line" }, { x: 0, y: 0, width: 100, height: 100 })).toBe(
      "M5 45L95 45L95 55L5 55Z",
    );
  });

  it("closes the open scribble and starts it at its own first point", () => {
    const d = maskOutlinePath({ geoShape: "scribble" }, { x: 0, y: 0, width: 100, height: 100 })!;
    expect(pairsOf(d)[0][0]).toBeCloseTo(0, 6);
    expect(pairsOf(d)[0][1]).toBeCloseTo(83.333, 2);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("scales an svgPath from its own viewBox into the box", () => {
    // Viewbox 0 0 200 200; the point (100,100) lands at the centre of the box.
    const d = maskOutlinePath(
      { svgPath: "M0 0 L100 100 Z", svgViewBox: "0 0 200 200" },
      { x: 0, y: 0, width: 50, height: 50 },
    );
    expect(d).toBe("M0 0L25 25Z");
  });

  it("stretches a non-square svgViewBox onto both box axes, as the editor does", () => {
    // Editor frame-svg.ts boxMatrix scales x and y independently. Preserving the
    // aspect would give "M0 0L25 25Z" instead.
    const d = maskOutlinePath(
      { svgPath: "M0 0 L100 100 Z", svgViewBox: "0 0 200 100" },
      { x: 0, y: 0, width: 50, height: 50 },
    );
    expect(d).toBe("M0 0L25 50Z");
  });

  it("an unknown geoShape with an svgPath uses the svgPath, never a circle", () => {
    expect(maskOutlinePath({ geoShape: "nope", svgPath: "M0 0 L10 0 L10 10 Z" }, { x: 0, y: 0, width: 100, height: 100 }))
      .toBe("M0 0L10 0L10 10Z");
  });

  it("a catalogue geoShape wins over an svgPath", () => {
    expect(maskOutlinePath({ geoShape: "diamond", svgPath: "M0 0 L10 0 L10 10 Z" }, { x: 0, y: 0, width: 100, height: 100 }))
      .toBe("M50 0L100 50L50 100L0 50Z");
  });

  it("returns null for a malformed svgViewBox instead of guessing", () => {
    expect(maskOutlinePath({ svgPath: "M0 0 L1 1", svgViewBox: "0 0 0 0" }, box)).toBeNull();
  });
});
