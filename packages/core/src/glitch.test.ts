/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The glitch as portable primitives: one definition for the editor canvas and
// the player (it was copied in both), and a fixed, small number of copies.
import { describe, it, expect } from "vitest";
import { calculateGlitchState, glitchLayers, GLITCH_CALM_RATIO } from "./glitch.js";

const burst = 0.9; // seconds into the cycle at speed 1: past the calm ratio
const calm = 0.2;

describe("glitch", () => {
  it("is still at t = 0, before the delay and in the calm part of the cycle", () => {
    expect(calculateGlitchState(0).isActive).toBe(false);
    expect(calculateGlitchState(burst, 1, 2).isActive).toBe(false);
    expect(calculateGlitchState(calm).isActive).toBe(false);
    expect(GLITCH_CALM_RATIO).toBe(0.7);
  });

  it("is deterministic: the same time gives the same frame", () => {
    expect(calculateGlitchState(burst, 1, 0, 60)).toEqual(calculateGlitchState(burst, 1, 0, 60));
    expect(calculateGlitchState(burst).isActive).toBe(true);
  });

  it("cyberpunk: the text with a skew plus two colour ghosts, hidden out of a burst", () => {
    const on = glitchLayers("glitch-cyberpunk", calculateGlitchState(burst, 1, 0, 100));
    expect(on.copies.map((c) => c.color)).toEqual(["#00ffff", "#ff00ff"]);
    expect(on.copies.every((c) => c.opacity === 0.85)).toBe(true);
    const off = glitchLayers("glitch-cyberpunk", calculateGlitchState(calm));
    expect(off.skewX).toBe(0);
    expect(off.copies.every((c) => c.opacity === 0)).toBe(true);
  });

  it("slice: one band, cut by a rectangle and shifted, hidden out of a burst", () => {
    const s = calculateGlitchState(burst, 1, 0, 100);
    const on = glitchLayers("glitch-slice", s);
    expect(on.copies).toHaveLength(1);
    expect(on.copies[0]).toMatchObject({ dx: s.slices[0].shiftX, opacity: 1, clip: { top: s.slices[0].topPercent, bottom: s.slices[0].bottomPercent } });
    expect(glitchLayers("glitch-slice", calculateGlitchState(calm)).copies[0].opacity).toBe(0);
  });

  it("frames only hold portable primitives", () => {
    const keys = new Set<string>();
    for (const t of ["glitch-cyberpunk", "glitch-slice"] as const) {
      const f = glitchLayers(t, calculateGlitchState(burst, 1, 0, 100));
      Object.keys(f).forEach((k) => keys.add(k));
      f.copies.forEach((c) => Object.keys(c).forEach((k) => keys.add("copy." + k)));
    }
    expect([...keys].sort()).toEqual(["copies", "copy.clip", "copy.color", "copy.dx", "copy.dy", "copy.opacity", "skewX"]);
  });
});
