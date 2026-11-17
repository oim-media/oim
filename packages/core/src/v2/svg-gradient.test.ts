/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { svgGradientAttrs } from "./svg-gradient.js";

const stops = [{ color: "#7D03FC", at: 0 }, { color: "#2563EB", at: 1 }];

describe("svgGradientAttrs", () => {
  it("a 180deg linear runs top to bottom through the viewBox centre", () => {
    const g = svgGradientAttrs({ type: "linear", angle: 180, stops }, [0, 0, 24, 24]);
    expect(g.tag).toBe("linearGradient");
    expect(g.attrs.x1).toBeCloseTo(12); expect(g.attrs.y1).toBeCloseTo(0);
    expect(g.attrs.x2).toBeCloseTo(12); expect(g.attrs.y2).toBeCloseTo(24);
    expect(g.stops).toEqual([{ offset: "0%", color: "#7D03FC" }, { offset: "100%", color: "#2563EB" }]);
  });

  it("90deg goes left to right and honours the viewBox origin", () => {
    const g = svgGradientAttrs({ type: "linear", angle: 90, stops }, [10, 0, 20, 10]);
    expect(g.attrs.x1).toBeCloseTo(10); expect(g.attrs.x2).toBeCloseTo(30);
    expect(g.attrs.y1).toBeCloseTo(5); expect(g.attrs.y2).toBeCloseTo(5);
  });

  it("a radial is centred, reaching the farthest corner; stops without position spread evenly", () => {
    const g = svgGradientAttrs({ type: "radial", stops: [{ color: "#000" }, { color: "#111" }, { color: "#fff" }] }, [0, 0, 6, 8]);
    expect(g.tag).toBe("radialGradient");
    expect(g.attrs).toEqual({ cx: 3, cy: 4, r: 5 });
    expect(g.stops.map((s) => s.offset)).toEqual(["0%", "50%", "100%"]);
  });
});
