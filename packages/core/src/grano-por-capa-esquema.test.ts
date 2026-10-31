/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Contract 1.10.0: a layer's grain carries its size and blend mode.

import { describe, it, expect } from "vitest";
import { styleSchema } from "./schema";
import { CONTRACT_VERSION } from "./compatibility";

describe("styleSchema 1.10.0: per-layer grain", () => {
  it("accepts grain with intensity, size and blend", () => {
    const r = styleSchema.safeParse({ grain: true, grainIntensity: 25, grainSize: 70, grainBlend: "soft-light" });
    expect(r.success).toBe(true);
  });

  it("rejects a size out of 1-100 and an unknown blend", () => {
    expect(styleSchema.safeParse({ grainSize: 0 }).success).toBe(false);
    expect(styleSchema.safeParse({ grainSize: 101 }).success).toBe(false);
    expect(styleSchema.safeParse({ grainBlend: "screen" }).success).toBe(false);
  });

  it("an old file with only grain and intensity is still valid", () => {
    expect(styleSchema.safeParse({ grain: true, grainIntensity: 20 }).success).toBe(true);
  });

  // Was pinned to "1.10.0"; text marks raised the contract to 1.11.0. What
  // this test guards is that the grain exists since 1.10.0.
  it("the contract is at least 1.10.0", () => {
    const [major, minor] = CONTRACT_VERSION.split(".").map(Number);
    expect(major * 1000 + minor).toBeGreaterThanOrEqual(1010);
  });
});
