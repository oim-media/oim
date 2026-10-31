/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { nextWheelZoom } from "./wheelZoom";

describe("nextWheelZoom", () => {
  it("one mouse-wheel notch still moves about 5%", () => {
    expect(nextWheelZoom(1, -100, 0, false)).toBeCloseTo(1.05, 2);
    expect(nextWheelZoom(2, 100, 0, false)).toBeCloseTo(2 / 1.05, 2);
  });

  it("a 1px trackpad tail barely moves it, so sign flips cannot shake the image", () => {
    let z = 1.4;
    for (const d of [1, -1, 1, -1, 2, 1, -1]) z = nextWheelZoom(z, d, 0, false);
    expect(Math.abs(z - 1.4)).toBeLessThan(0.002);
  });

  it("zooming in and back out by the same amount returns to the start", () => {
    expect(nextWheelZoom(nextWheelZoom(1.5, -40, 0, false), 40, 0, false)).toBeCloseTo(1.5, 10);
  });

  it("normalises line and page wheel modes to pixels", () => {
    expect(nextWheelZoom(1, -3, 1, false)).toBeCloseTo(nextWheelZoom(1, -48, 0, false), 10);
    expect(nextWheelZoom(1, -1, 2, false)).toBeCloseTo(nextWheelZoom(1, -800, 0, false), 10);
  });

  it("a pinch (ctrl + wheel) is more responsive than scrolling", () => {
    expect(nextWheelZoom(1, -10, 0, true)).toBeGreaterThan(nextWheelZoom(1, -10, 0, false));
  });

  it("stays within 1x and 4x", () => {
    expect(nextWheelZoom(1, 500, 0, false)).toBe(1);
    expect(nextWheelZoom(3.9, -5000, 0, false)).toBe(4);
  });
});
