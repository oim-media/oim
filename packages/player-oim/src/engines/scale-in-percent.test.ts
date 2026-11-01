/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { scaleAsFactor, stateStyles } from "./states";

describe("the scale of an interactive state travels as a percentage", () => {
  it("103 enlarges by 3%, not one hundred and three times", () => {
    // The real failure, measured on published works:
    // the value was passed as-is to a CSS that multiplies.
    expect(scaleAsFactor(103)).toBeCloseTo(1.03);
    expect(stateStyles({ scale: 103 })["--oim-slot-hover-scale"]).toBe("1.03");
  });

  it("the five values that exist in real files stay close to 1", () => {
    for (const medido of [96, 97, 103, 105, 106]) {
      const factor = scaleAsFactor(medido);
      expect(factor).toBeGreaterThan(0.9);
      expect(factor).toBeLessThan(1.1);
    }
  });

  it("100 es el tamano natural", () => {
    expect(scaleAsFactor(100)).toBe(1);
  });

  describe("the bridge for the multipliers the contract used to allow", () => {
    it("a 1.1 from before is still 10% more, not 1%", () => {
      // Without the bridge, dividing by 100 would shrink it to 0.011: the layer would
      // vanish when the mouse went over it. No file like that exists, but the contract
      // allowed them and the arithmetic does not tell them apart on its own.
      expect(scaleAsFactor(1.1)).toBe(1.1);
      expect(scaleAsFactor(1.5)).toBe(1.5);
    });

    it("the cut-off is at 10, which was the old contract's ceiling", () => {
      expect(scaleAsFactor(10)).toBe(10);
      expect(scaleAsFactor(11)).toBeCloseTo(0.11);
    });
  });

  it("opacity stays a percentage, as it already was", () => {
    // The pair that gave the bug away: same unit, same object, and only one of the
    // two was divided.
    expect(stateStyles({ opacity: 50 }).opacity).toBe("0.5");
  });
});
