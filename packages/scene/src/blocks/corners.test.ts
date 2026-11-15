/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { applyCorners } from "./corners.js";

const radius = (corners: number | number[] | undefined, round = false) => {
  const el = document.createElement("div");
  applyCorners(el, { corners }, round);
  return el.style.borderRadius;
};

describe("applyCorners", () => {
  it("one number is the same radius at every corner, in px as the player writes it", () => {
    expect(radius(12)).toBe("12px");
  });

  it("four numbers are the corners top-left, top-right, bottom-right, bottom-left", () => {
    expect(radius([4, 8, 12, 16])).toBe("4px 8px 12px 16px");
  });

  it("no corners leaves the box square; a round figure keeps its own rounding", () => {
    expect(radius(undefined)).toBe("");
    expect(radius(12, true)).toBe("");
  });
});
