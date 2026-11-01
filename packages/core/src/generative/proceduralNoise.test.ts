/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { buildSvgNoiseFilter, generateBlobPath, generateScribblePath } from "./proceduralNoise";

describe("Procedural Noise & Blob Geometry Pure Functions", () => {
  describe("buildSvgNoiseFilter", () => {
    it("generates deterministic SVG noise filter markup with bounded parameters", () => {
      const filterXml = buildSvgNoiseFilter("oim-noise-filter", { intensity: 18, baseFrequency: 0.8 });
      expect(filterXml).toContain('<filter id="oim-noise-filter"');
      expect(filterXml).toContain('type="fractalNoise"');
      expect(filterXml).toContain('baseFrequency="0.8"');
      expect(filterXml).toContain('stitchTiles="stitch"');
      expect(filterXml).toContain('numOctaves="3"');
    });

    it("clamps extreme frequencies and intensities to safe bounds", () => {
      const clampedLow = buildSvgNoiseFilter("safe-low", { intensity: -50, baseFrequency: 0.01 });
      expect(clampedLow).toContain('baseFrequency="0.1"');

      const clampedHigh = buildSvgNoiseFilter("safe-high", { intensity: 200, baseFrequency: 5.0 });
      expect(clampedHigh).toContain('baseFrequency="2"');
    });
  });

  describe("generateBlobPath", () => {
    it("generates smooth closed cubic Bezier path for blob shape given a seed", () => {
      const pathA = generateBlobPath({ seed: 42, points: 6, randomness: 0.35 });
      const pathB = generateBlobPath({ seed: 42, points: 6, randomness: 0.35 });
      const pathDifferent = generateBlobPath({ seed: 99, points: 6, randomness: 0.35 });

      expect(pathA.startsWith("M")).toBe(true);
      expect(pathA.endsWith("Z")).toBe(true);
      expect(pathA).toBe(pathB); // Deterministic with the same seed
      expect(pathA).not.toBe(pathDifferent);
    });

    it("produces valid path with default parameters when options are empty", () => {
      const defaultPath = generateBlobPath();
      expect(defaultPath).toBeDefined();
      expect(defaultPath.length).toBeGreaterThan(20);
      expect(defaultPath.startsWith("M")).toBe(true);
      expect(defaultPath.endsWith("Z")).toBe(true);
    });
  });

  describe("generateScribblePath", () => {
    it("generates deterministic open spline path for scribble given a seed", () => {
      const pathA = generateScribblePath({ seed: 123, segments: 6 });
      const pathB = generateScribblePath({ seed: 123, segments: 6 });
      const pathDifferent = generateScribblePath({ seed: 456, segments: 6 });

      expect(pathA.startsWith("M")).toBe(true);
      expect(pathA.includes("Q")).toBe(true);
      expect(pathA).toBe(pathB);
      expect(pathA).not.toBe(pathDifferent);
    });
  });
});

