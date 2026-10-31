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
describe("grano global con color", () => {
  const SIN_COLOR =
    '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>';

  it("sin color el filtro es exactamente el de siempre", () => {
    expect(buildSvgNoiseFilter("g", { intensity: 15, baseFrequency: 0.8 })).toBe(SIN_COLOR);
  });

  it("con color el ruido se tine de ese color", () => {
    const f = buildSvgNoiseFilter("g", { color: "#fb0101" });
    expect(f).toContain('flood-color="#fb0101"');
    expect(f).toContain("luminanceToAlpha");
    expect(f).not.toContain('type="saturate"');
  });

  it("un color que no es hex ni rgb se ignora: grano de siempre, nada inyectado", () => {
    const f = buildSvgNoiseFilter("g", { color: '"/><script>alert(1)</script>' });
    expect(f).toBe(SIN_COLOR);
  });

  it("el esquema acepta grain.color y rechaza lo que no es un color", () => {
    expect(grainConfigSchema.parse({ enabled: true, color: "#fb0101" }).color).toBe("#fb0101");
    expect(() => grainConfigSchema.parse({ enabled: true, color: "javascript:alert(1)" })).toThrow();
  });
});
