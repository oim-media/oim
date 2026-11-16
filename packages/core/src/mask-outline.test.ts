/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES } from "./geoShapes";
import { maskOutlinePath } from "./mask-outline";

const box = { x: 0, y: 0, width: 100, height: 100 };
const circleD = maskOutlinePath({ geoShape: "circle" }, box);

describe("maskOutlinePath", () => {
  it.each(Object.keys(GEO_SHAPES).filter((n) => n !== "circle"))(
    "%s yields its own outline, not the circle",
    (name) => {
      const d = maskOutlinePath({ geoShape: name }, box);
      expect(d).toBeTruthy();
      expect(d).not.toBe(circleD);
    },
  );

  it("returns null for an unknown name, never a circle", () => {
    expect(maskOutlinePath({ geoShape: "nope" }, box)).toBeNull();
  });

  it("fits the box: every coordinate lies inside it", () => {
    const d = maskOutlinePath({ geoShape: "arch" }, { x: 50, y: 20, width: 40, height: 10 })!;
    const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(50 - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(30 + 1e-6);
  });

  it("converts a polygon to a closed path scaled to the box", () => {
    // Diamond in the 0-100 catalogue space, placed in a 200x100 box offset by (10,0).
    expect(maskOutlinePath({ geoShape: "diamond" }, { x: 10, y: 0, width: 200, height: 100 })).toBe(
      "M110 5L200 50L110 95L20 50Z",
    );
  });

  it("gives line its surface band, not its zero-area stroke", () => {
    expect(maskOutlinePath({ geoShape: "line" }, box)).toBe("M5 45L95 45L95 55L5 55Z");
  });

  it("closes the open scribble so it encloses a surface", () => {
    const d = maskOutlinePath({ geoShape: "scribble" }, box);
    expect(d).toMatch(/Z$/);
  });

  it("scales an svgPath from its own viewBox into the box", () => {
    // Viewbox 0 0 200 200; the point (100,100) lands at the centre of the box.
    const d = maskOutlinePath(
      { svgPath: "M0 0 L100 100 Z", svgViewBox: "0 0 200 200" },
      { x: 0, y: 0, width: 50, height: 50 },
    );
    expect(d).toBe("M0 0L25 25Z");
  });

  it("returns null for a malformed svgViewBox instead of guessing", () => {
    expect(maskOutlinePath({ svgPath: "M0 0 L1 1", svgViewBox: "0 0 0 0" }, box)).toBeNull();
  });
});
