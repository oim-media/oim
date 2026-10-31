/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { flipScale } from "./flip.js";
import { styleSchema } from "./schema.js";

describe("flipScale", () => {
  it("is null without a flip", () => {
    expect(flipScale()).toBeNull();
    expect(flipScale(false, false)).toBeNull();
  });
  it("gives the scale pair for each flip", () => {
    expect(flipScale(true)).toEqual([-1, 1]);
    expect(flipScale(false, true)).toEqual([1, -1]);
    expect(flipScale(true, true)).toEqual([-1, -1]);
  });
});

describe("flipX/flipY in the layer style (1.14.0)", () => {
  it("are booleans only", () => {
    expect(styleSchema.safeParse({ flipX: true, flipY: false }).success).toBe(true);
    expect(styleSchema.safeParse({ flipX: "yes" }).success).toBe(false);
  });
});
