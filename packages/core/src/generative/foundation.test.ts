/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { createColorRamp, interpolateOklab } from "./ramp.js";
import { createDefsRegistry, buildSvgDocument } from "./svg.js";

describe("Generative Engine Foundation", () => {
  describe("PRNG Determinism (rng.ts)", () => {
    it("produces identical sequences with the same seed", () => {
      const rng1 = createRng(12345);
      const rng2 = createRng(12345);

      const seq1 = [rng1.next(), rng1.next(), rng1.range(10, 50), rng1.pick(["a", "b", "c"])];
      const seq2 = [rng2.next(), rng2.next(), rng2.range(10, 50), rng2.pick(["a", "b", "c"])];

      expect(seq1).toEqual(seq2);
    });

    it("produces independent flows for different seeds", () => {
      const rng1 = createRng(111);
      const rng2 = createRng(999);

      expect(rng1.next()).not.toEqual(rng2.next());
    });

    it("picks valid range and array elements", () => {
      const rng = createRng(42);
      const val = rng.range(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);

      const picked = rng.pick([1, 2, 3]);
      expect([1, 2, 3]).toContain(picked);
    });
  });

  describe("OKLab Color Ramp (ramp.ts)", () => {
    it("preserves exact endpoints for t=0 and t=1", () => {
      const start = "#3b82f6";
      const end = "#0f172a";

      expect(interpolateOklab(start, end, 0)).toBe(start);
      expect(interpolateOklab(start, end, 1)).toBe(end);
    });

    it("generates N distinct colors for N layers", () => {
      const ramp = createColorRamp({
        mode: "monochrome",
        stops: ["#3b82f6", "#0f172a"]
      });

      const totalLayers = 5;
      const colors = Array.from({ length: totalLayers }, (_, i) => ramp(i, totalLayers));

      expect(colors).toHaveLength(5);
      expect(new Set(colors).size).toBe(5);
      expect(colors[0]).toBe("#3b82f6");
      expect(colors[4]).toBe("#0f172a");
    });
  });

  describe("SVG Document & DefsRegistry (svg.ts)", () => {
    it("deduplicates identical gradients in DefsRegistry", () => {
      const defs = createDefsRegistry();

      const stops = [
        { offset: 0, color: "#ff0000" },
        { offset: 100, color: "#0000ff" }
      ];

      const id1 = defs.registerLinearGradient(stops, "0%", "0%", "100%", "100%");
      const id2 = defs.registerLinearGradient(stops, "0%", "0%", "100%", "100%");
      const id3 = defs.registerLinearGradient(stops, "0%", "0%", "100%", "50%");

      expect(id1).toBe("def-grad-1");
      expect(id2).toBe("def-grad-1");
      expect(id3).toBe("def-grad-2");

      const serialized = defs.serialize();
      expect(serialized).toContain('id="def-grad-1"');
      expect(serialized).toContain('id="def-grad-2"');
    });

    it("generates dynamic viewBox matching project dimensions", () => {
      const defs = createDefsRegistry();
      const svg = buildSvgDocument({
        width: 900,
        height: 600,
        bleed: 2,
        defs,
        content: '<path d="M0 0 L900 600" />'
      });

      const decoded = decodeURIComponent(svg);
      expect(decoded).toContain('viewBox="0 0 900 602"');
      expect(decoded).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(decoded).not.toContain("1000 1000");
    });
  });
});
