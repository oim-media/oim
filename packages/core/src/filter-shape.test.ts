/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { clampRadius, filterClipPath } from "./filter-shape";

const box = { x: 0, y: 0, width: 10, height: 10 };

/** Every x,y pair in a path, read as numbers in order. */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]]);
  return pairs;
}

describe("clampRadius", () => {
  it("clamps the radius to half the short side", () => {
    expect(clampRadius(150, 142, 120)).toBe(60);
  });

  it("keeps a radius that already fits", () => {
    expect(clampRadius(10, 142, 120)).toBe(10);
  });

  it("clamps by the narrow side when the box is taller than wide", () => {
    expect(clampRadius(50, 20, 100)).toBe(10);
    expect(filterClipPath({ borderRadiusTopLeft: 50 }, { x: 0, y: 0, width: 20, height: 100 })).toMatch(/^M10 0 /);
  });
});

describe("filterClipPath", () => {
  it("a plain rectangle is the default and covers the box exactly", () => {
    const d = filterClipPath({}, box)!;
    expect(d).toMatch(/^M/);
    const xs = points(d).map(([x]) => x);
    const ys = points(d).map(([, y]) => y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 10, 0, 10]);
  });

  it("circle uses the catalogue outline, not the rectangle", () => {
    const rect = filterClipPath({}, box);
    expect(filterClipPath({ geoShape: "circle" }, box)).not.toBe(rect);
  });

  it("circle is round: it has curves and no straight edges", () => {
    const d = filterClipPath({ geoShape: "circle" }, box)!;
    expect(d).not.toMatch(/[LHV]/);
    expect(d).toMatch(/[CA]/);
  });

  it("rounded corners sit inside the box (no offset in y)", () => {
    const d = filterClipPath({ borderRadiusTopLeft: 150 }, { x: 0, y: 60, width: 142, height: 120 })!;
    const ys = points(d).map(([, y]) => y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(60 - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(180 + 1e-6);
  });

  it("a line or scribble filter has no shape clip", () => {
    expect(filterClipPath({ geoShape: "line" }, box)).toBeNull();
    expect(filterClipPath({ geoShape: "scribble" }, box)).toBeNull();
  });

  it("an unknown shape has no clip path", () => {
    expect(filterClipPath({ geoShape: "nope" }, box)).toBeNull();
  });
});
