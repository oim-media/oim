/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { grainFrequency, buildLayerGrainFilter, GRAIN_BLENDS } from "./proceduralNoise";

describe("grainFrequency", () => {
  it("size 1 is the finest grain, size 100 the coarsest", () => {
    expect(grainFrequency(1)).toBe(2);
    expect(grainFrequency(100)).toBe(0.2);
  });

  it("gets coarser (lower frequency) as the size grows", () => {
    expect(grainFrequency(25)).toBeGreaterThan(grainFrequency(50));
    expect(grainFrequency(50)).toBeGreaterThan(grainFrequency(75));
  });

  it("defaults to the middle and clamps out-of-range values", () => {
    expect(grainFrequency()).toBe(grainFrequency(50));
    expect(grainFrequency(-10)).toBe(2);
    expect(grainFrequency(500)).toBe(0.2);
    expect(grainFrequency(Number.NaN)).toBe(grainFrequency(50));
  });
});

describe("buildLayerGrainFilter", () => {
  const f = buildLayerGrainFilter("g1", { intensity: 30, size: 100, blend: "multiply" });

  it("is monochrome fractal noise at the size's frequency", () => {
    expect(f).toContain('<filter id="g1"');
    expect(f).toContain('type="fractalNoise"');
    expect(f).toContain('baseFrequency="0.2"');
    expect(f).toContain('type="saturate" values="0"');
  });

  it("only shows where the layer has ink", () => {
    expect(f).toMatch(/<feComposite[^>]*in2="SourceAlpha"[^>]*operator="in"/);
  });

  it("scales by the intensity and blends with the layer in the chosen mode", () => {
    expect(f).toContain('slope="0.3"');
    expect(f).toMatch(/<feBlend[^>]*in2="SourceGraphic"[^>]*mode="multiply"/);
  });

  it("falls back to safe values: overlay, intensity 20, clamped", () => {
    const g = buildLayerGrainFilter("g2", { blend: "screen" as never });
    expect(g).toContain('mode="overlay"');
    expect(g).toContain('slope="0.2"');
    expect(buildLayerGrainFilter("g3", { intensity: 400 })).toContain('slope="1"');
  });

  it("is deterministic: same input, same markup", () => {
    expect(buildLayerGrainFilter("g1", { intensity: 30, size: 100, blend: "multiply" })).toBe(f);
  });

  it("offers exactly the three blends of the spec", () => {
    expect([...GRAIN_BLENDS]).toEqual(["overlay", "soft-light", "multiply"]);
  });
});
