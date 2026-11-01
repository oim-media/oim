/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED, and CANONICAL TABLE. It is copied as-is into the editor: the same
 * cases and the same numbers run on both sides. Having the table travel with
 * the module is what prevents a copy from being adjusted "just a little".
 */

import { describe, it, expect } from "vitest";
import {
  maxOffset,
  oversizeScale,
  MAX_SCALE,
  type ParallaxAxis,
} from "./oversize";

const CANVAS = { width: 800, height: 600 };

interface Caso {
  name: string;
  caja: { left: number; top: number; width: number; height: number };
  depth: number;
  eje?: ParallaxAxis;
  esperado: number;
}

const CASOS: Caso[] = [
  {
    name: "a layer in the middle of the canvas is left alone",
    caja: { left: 300, top: 200, width: 200, height: 200 },
    depth: 0.5,
    esperado: 1,
  },
  {
    name: "the horizon, which runs from side to side and touches the ground",
    caja: { left: 0, top: 450, width: 800, height: 150 },
    depth: 0.6,
    // d = 18. For x it takes 18 over 800 -> 1.045; for y, 18 over 150 ->
    // 1.24. The larger one wins: a single factor, or the layer gets distorted.
    esperado: 1.24,
  },
  {
    name: "the moon, loose at the top right, needs nothing",
    caja: { left: 600, top: 60, width: 100, height: 100 },
    depth: 0.2,
    esperado: 1,
  },
  {
    name: "a layer that only moves vertically ignores the side edge",
    caja: { left: 0, top: 250, width: 200, height: 100 },
    depth: 0.5,
    eje: "y_only",
    esperado: 1,
  },
  {
    name: "...but the same layer with a free axis does correct it",
    caja: { left: 0, top: 250, width: 200, height: 100 },
    depth: 0.5,
    eje: "both",
    // d = 15, anchored to the left: 15 over 200 -> 1 + 30/200
    esperado: 1.15,
  },
  {
    name: "without depth there is no movement and nothing to cover",
    caja: { left: 0, top: 0, width: 800, height: 600 },
    depth: 0,
    esperado: 1,
  },
  {
    name: "a layer that ALREADY overhangs the canvas is left alone",
    caja: { left: -50, top: 200, width: 900, height: 200 },
    depth: 0.5,
    // It overhangs by 50 on each side and only moves 15: that already covers it with room to spare.
    esperado: 1,
  },
  {
    name: "a tiny layer in the corner is clamped instead of distorted",
    caja: { left: 0, top: 0, width: 20, height: 20 },
    depth: 1,
    // It would ask for 1 + 60/20 = 4. Enlarging a layer four times does not fix it.
    esperado: MAX_SCALE,
  },
  {
    name: "a layer that is ALMOST touching also counts, not only one that touches",
    caja: { left: 5, top: 250, width: 200, height: 100 },
    depth: 0.5,
    // d = 15 and the margin is 5, less than d: it is anchored. It takes 15 + 5 =
    // 20 so that not even at the worst displacement is the background visible.
    esperado: 1.2,
  },
];

describe("the parallax oversize scale", () => {
  for (const c of CASOS) {
    it(c.name, () => {
      expect(oversizeScale(CANVAS && c.caja, CANVAS, c.depth, c.eje)).toBe(c.esperado);
    });
  }
});

describe("a layer with an infinite-loop track is left alone", () => {
  const horizonte = { left: 0, top: 450, width: 800, height: 150 };

  it("without a track, the horizon is enlarged", () => {
    expect(oversizeScale(horizonte, CANVAS, 0.6, "both", false)).toBe(1.24);
  });

  it("with a track it is NOT enlarged: the track already covers the canvas all the way round", () => {
    // And enlarging it would do harm: each piece would look bigger than drawn,
    // and the number of pieces was calculated for the unscaled size.
    expect(oversizeScale(horizonte, CANVAS, 0.6, "both", true)).toBe(1);
  });

  it("by default it is assumed there is NO track", () => {
    // The parameter is the last and optional one: whoever does not pass it
    // behaves as before. If the default were `true`, adding a new call would
    // disable the oversizing without anyone noticing.
    expect(oversizeScale(horizonte, CANVAS, 0.6, "both")).toBe(1.24);
  });
});

describe("el desplazamiento maximo", () => {
  it("it is 30 because of the depth, not 60", () => {
    // The controller's comment says "Max +- 60px scaled by depth" and it is
    // false: the normalized mouse is bounded to [-0.5, +0.5].
    expect(maxOffset(1)).toBe(30);
    expect(maxOffset(0.5)).toBe(15);
  });

  it("a negative depth moves the same amount, the other way", () => {
    expect(maxOffset(-0.5)).toBe(15);
  });

  it("a nonsensical value breaks nothing", () => {
    expect(maxOffset(NaN)).toBe(0);
  });
});
