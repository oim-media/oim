/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { buildSvgNoiseFilter } from "./proceduralNoise";
import { grainConfigSchema } from "../schema";

/**
 * The global grain had no color: the filter always desaturated the noise.
 * `color` is optional, and without it the filter must stay byte for byte the
 * one every published .oim was made with.
 */
describe("global grain with color", () => {
  const SIN_COLOR =
    '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>';

  it("without color the filter is exactly the usual one", () => {
    expect(buildSvgNoiseFilter("g", { intensity: 15, baseFrequency: 0.8 })).toBe(SIN_COLOR);
  });

  it("with color the noise is tinted with that color", () => {
    const f = buildSvgNoiseFilter("g", { color: "#fb0101" });
    expect(f).toContain('flood-color="#fb0101"');
    expect(f).toContain("luminanceToAlpha");
    expect(f).not.toContain('type="saturate"');
  });

  it("a color that is neither hex nor rgb is ignored: usual grain, nothing injected", () => {
    const f = buildSvgNoiseFilter("g", { color: '"/><script>alert(1)</script>' });
    expect(f).toBe(SIN_COLOR);
  });

  it("the schema accepts grain.color and rejects what is not a color", () => {
    expect(grainConfigSchema.parse({ enabled: true, color: "#fb0101" }).color).toBe("#fb0101");
    expect(() => grainConfigSchema.parse({ enabled: true, color: "javascript:alert(1)" })).toThrow();
  });
});
