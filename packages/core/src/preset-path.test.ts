/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES } from "./geoShapes";
import { normalizePathData } from "./path-data";
import { presetPath } from "./preset-path";

/** Bounding box of path data, sampling every curve finely. */
function bbox(d: string) {
  const ops = normalizePathData(d)!;
  const xs: number[] = [];
  const ys: number[] = [];
  let [cx, cy] = [0, 0];
  for (const { cmd, args } of ops) {
    if (cmd === "Z") continue;
    if (cmd === "C") {
      const [x1, y1, x2, y2, x3, y3] = args;
      for (let i = 0; i <= 400; i++) {
        const t = i / 400, u = 1 - t;
        xs.push(u ** 3 * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3);
        ys.push(u ** 3 * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3);
      }
    }
    [cx, cy] = [args[args.length - 2], args[args.length - 1]];
    xs.push(cx);
    ys.push(cy);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe("presetPath", () => {
  it("returns a pixel-space viewBox equal to the box", () => {
    expect(presetPath("arch", 320, 480)?.viewBox).toBe("0 0 320 480");
  });

  it("is null for the rectangle, unknown names and an empty box", () => {
    expect(presetPath("rectangle", 100, 100)).toBeNull();
    expect(presetPath("nope", 100, 100)).toBeNull();
    expect(presetPath("arch", 0, 100)).toBeNull();
  });

  it("starts the arch curve at y = 160 in a 320x480 box, as a true half circle", () => {
    const { d } = presetPath("arch", 320, 480)!;
    const ops = normalizePathData(d)!;
    expect(d).toContain("L0 160");
    const curve = ops.filter((o) => o.cmd === "C").at(-1)!; // the left corner, up to the top edge
    expect(curve.args[4]).toBeCloseTo(160, 6);
    expect(curve.args[5]).toBeCloseTo(0, 6);
    expect(bbox(d)).toMatchObject({ x0: 0, x1: 320, y0: 0, y1: 480 });
  });

  it("every preset spans its whole box, in tall, wide and square boxes", () => {
    for (const name of Object.keys(GEO_SHAPES)) {
      for (const [w, h] of [[320, 480], [600, 100], [200, 200]]) {
        const out = presetPath(name, w, h);
        expect(out, name).not.toBeNull();
        const b = bbox(out!.d);
        expect(Math.abs(b.x0), `${name} ${w}x${h} x0`).toBeLessThan(0.5);
        expect(Math.abs(b.x1 - w), `${name} ${w}x${h} x1`).toBeLessThan(0.5);
        if (name !== "line") {
          expect(Math.abs(b.y0), `${name} ${w}x${h} y0`).toBeLessThan(0.5);
          expect(Math.abs(b.y1 - h), `${name} ${w}x${h} y1`).toBeLessThan(0.5);
        }
      }
    }
  });

  it("an inset keeps the whole stroke inside the box: every preset spans the box minus the inset", () => {
    for (const name of Object.keys(GEO_SHAPES)) {
      const out = presetPath(name, 300, 200, 5);
      expect(out!.viewBox, name).toBe("0 0 300 200");
      const b = bbox(out!.d);
      expect(Math.abs(b.x0 - 5), `${name} x0`).toBeLessThan(0.5);
      expect(Math.abs(b.x1 - 295), `${name} x1`).toBeLessThan(0.5);
      if (name !== "line") {
        expect(Math.abs(b.y0 - 5), `${name} y0`).toBeLessThan(0.5);
        expect(Math.abs(b.y1 - 195), `${name} y1`).toBeLessThan(0.5);
      }
    }
  });

  it("an inset never empties the box: it is capped at a quarter of the short side", () => {
    const b = bbox(presetPath("star", 40, 40, 100)!.d);
    expect(b.x0).toBeCloseTo(10, 0);
    expect(b.x1).toBeCloseTo(30, 0);
  });

  it("clamps the radius to half the short side", () => {
    const wide = normalizePathData(presetPath("pill", 600, 100)!.d)!;
    expect(wide.find((o) => o.cmd === "L")!.args[0]).toBe(550); // 600 - 50
    const tall = normalizePathData(presetPath("pill", 100, 600)!.d)!;
    expect(tall.find((o) => o.cmd === "L")!.args[0]).toBe(50);
    // Arch in a short box: radius min(w/2, h) = h, so the curve starts at the bottom edge.
    expect(presetPath("arch", 400, 50)!.d).toContain("L0 50A50 50 0 0 1 50 0Z");
  });

  it("bubble corners are 0.15 of the short side, not stretched", () => {
    const ops = normalizePathData(presetPath("bubble", 400, 200)!.d)!;
    expect(ops[0].args).toEqual([30, 0]);
    // The tail keeps its 1.x proportions: its tip is 17/90 of the width in, on the bottom edge.
    expect(presetPath("bubble", 400, 200)!.d).toContain("L75.56 200");
    // The body is 67/88 of the height: in an 88 px box its bottom edge is at 67.
    expect(presetPath("bubble", 400, 88)!.d).toContain("A13.2 13.2 0 0 1 386.8 67");
  });

  it("the circle is the ellipse inscribed in the box", () => {
    const b = bbox(presetPath("circle", 300, 100)!.d);
    expect(b.x1).toBeCloseTo(300, 0);
    expect(b.y1).toBeCloseTo(100, 0);
  });

  it("the line sits on the middle of the box", () => {
    expect(presetPath("line", 200, 40)!.d).toBe("M0 20L200 20");
  });
});
