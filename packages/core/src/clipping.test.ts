/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Order matters more than the rules.
 *
 * A text parallax group exists (a looping headline ribbon), and if the text won,
 * the loop would stop being clipped and the whole track would show.
 * That combination is what decides the order of the three rules, and the one that a
 * test per rule would not have touched.
 */

import { describe, it, expect } from "vitest";
import { slotClipping } from "./clipping";

const slot = (p: Partial<Parameters<typeof slotClipping>[0]> = {}) => ({
  isText: false, isParallaxGroup: false, hasFilterOrShadow: false, hasKeyframes: false, ...p,
});

describe("slotClipping", () => {
  it("text is not clipped: the ink that overhangs its line box is its own", () => {
    expect(slotClipping(slot({ isText: true }))).toBe("visible");
  });

  it("any other layer is clipped", () => {
    expect(slotClipping(slot())).toBe("hidden");
  });

  it("with a shadow or filter it is not clipped: it is painted outside the box", () => {
    expect(slotClipping(slot({ hasFilterOrShadow: true }))).toBe("visible");
  });

  /**
   * The combination that decides the order. Without this, putting the text rule
   * before the parallax one passed in green and broke the loop in production.
   */
  it("a TEXT parallax group keeps clipping", () => {
    expect(slotClipping(slot({ isText: true, isParallaxGroup: true }))).toBe("hidden");
  });

  it("a parallax group with a shadow also keeps clipping", () => {
    expect(slotClipping(slot({ hasFilterOrShadow: true, isParallaxGroup: true }))).toBe("hidden");
  });

  it("text with a shadow is not clipped twice", () => {
    expect(slotClipping(slot({ isText: true, hasFilterOrShadow: true }))).toBe("visible");
  });

  // offline_oim (6 Nov 2026): the keyframes move a wrapper INSIDE the slot, so a
  // clipped slot hid the jumping dino and showed the cactus only near its home box.
  it("an image moved by keyframes is not clipped by its own box", () => {
    expect(slotClipping(slot({ hasKeyframes: true }))).toBe("visible");
  });

  it("a parallax group keeps clipping even with keyframes", () => {
    expect(slotClipping(slot({ hasKeyframes: true, isParallaxGroup: true }))).toBe("hidden");
  });
});
