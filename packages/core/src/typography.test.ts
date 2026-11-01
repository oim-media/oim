/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Making sure line height stops having four opinions.
 *
 * The case that really bites is the STRING: published .oim files carry
 * `lineHeight: "1.2"`, not `1.2`. A check that only accepted numbers would
 * pass green while every real file silently falls back to the default value.
 */

import { describe, it, expect } from "vitest";
import {
  resolveLineHeight,
  DEFAULT_LINE_HEIGHT,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
  inkMargin,
  MAX_FONT_HEIGHT,
} from "./typography";

describe("resolveLineHeight", () => {
  it("reads the number", () => {
    expect(resolveLineHeight({ lineHeight: 1.6 })).toBe(1.6);
  });

  /** What published .oim files carry, measured across three of them. */
  it("reads the numeric string, which is what real files contain", () => {
    expect(resolveLineHeight({ lineHeight: "1.2" })).toBe(1.2);
  });

  it("without line height it returns the same value the editor paints", () => {
    expect(resolveLineHeight({})).toBe(DEFAULT_LINE_HEIGHT);
    expect(resolveLineHeight(undefined)).toBe(DEFAULT_LINE_HEIGHT);
    expect(resolveLineHeight(null)).toBe(DEFAULT_LINE_HEIGHT);
  });

  it.each([0, -1, "0", "-2", "", "   ", "tall", NaN, Infinity, {}, []])(
    "falls back to the default value for %p",
    (v) => {
      expect(resolveLineHeight({ lineHeight: v })).toBe(DEFAULT_LINE_HEIGHT);
    },
  );

  /**
   * `<input type="number" min max>` does not stop typing outside the range: the
   * attribute only blocks submitting a form, and the editor has none. A file can
   * carry 99, and 99 lines of height per line is text that covers the rest of
   * the document.
   */
  it("clamps to the limits the editor offers", () => {
    expect(resolveLineHeight({ lineHeight: 99 })).toBe(MAX_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: 0.1 })).toBe(MIN_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: "500" })).toBe(MAX_LINE_HEIGHT);
  });

  it("the range ends pass through unchanged", () => {
    expect(resolveLineHeight({ lineHeight: MIN_LINE_HEIGHT })).toBe(MIN_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: MAX_LINE_HEIGHT })).toBe(MAX_LINE_HEIGHT);
  });

  /**
   * The default value must fall within the range, or the editor and the player
   * would disagree in the most common case: the layer that says nothing.
   */
  it("the default value is within the range", () => {
    expect(DEFAULT_LINE_HEIGHT).toBeGreaterThanOrEqual(MIN_LINE_HEIGHT);
    expect(DEFAULT_LINE_HEIGHT).toBeLessThanOrEqual(MAX_LINE_HEIGHT);
  });
});

describe("inkMargin", () => {
  /**
   * The case at hand: line height 1.2, which is what real .oim files carry.
   * Poppins declares 1.396 em of height, so it protrudes 0.196 -0.098 per
   * side-. Without that margin, the "j" and the "p" lose their fill at the
   * bottom.
   */
  it("with the line height of real files, it leaves margin", () => {
    expect(inkMargin(1.2)).toBeCloseTo(0.1, 3);
  });

  it("the tighter it is, the more margin is needed", () => {
    expect(inkMargin(1.0)).toBeGreaterThan(inkMargin(1.2));
    expect(inkMargin(0.8)).toBeGreaterThan(inkMargin(1.0));
  });

  /**
   * The half that is usually forgotten. A fixed margin would always enlarge the
   * background area, and a VERTICAL gradient is spread over it: its colors would
   * move even when there is nothing to compensate.
   */
  it("with a generous line height it adds NOTHING", () => {
    expect(inkMargin(1.4)).toBe(0);
    expect(inkMargin(1.5)).toBe(0);
    expect(inkMargin(3)).toBe(0);
  });

  it("the exact limit adds no margin", () => {
    expect(inkMargin(MAX_FONT_HEIGHT)).toBe(0);
  });

  it("an impossible value falls back to the default line height", () => {
    expect(inkMargin(0)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
    expect(inkMargin(NaN)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
    expect(inkMargin(-1)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
  });

  /**
   * The constant comes from a measurement, not from intuition: it is Poppins'
   * height, the largest of the six fonts measured. If it were lowered, the font
   * that protrudes the most would be cut off again.
   */
  it("the maximum height covers Poppins, which is the worst case", () => {
    expect(MAX_FONT_HEIGHT).toBeGreaterThanOrEqual(1.396);
  });
});
