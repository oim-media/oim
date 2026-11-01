/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { renderGenerativeSVG } from "./index.js";
import { GENERATOR_CATALOG } from "./catalog.js";
import type { GeneratorSpec } from "./types.js";

describe("generator composed of layers", () => {
  it("two layers emit two groups with their blend mode", () => {
    // Temporarily add a test spec to the catalog to exercise the composition
    const testSpec: GeneratorSpec = {
      id: "probe-dos-layers",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" }, blend: "screen" },
        { primitive: "radial", fixed: { kind: "rays" }, blend: "screen" }
      ],
      schema: []
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(renderGenerativeSVG(
        { generatorId: "probe-dos-layers", seed: 1 },
        { width: 200, height: 200 }
      ));
      expect(svg.match(/<g style="mix-blend-mode:/g)).toHaveLength(2);
      expect(svg).toContain("mix-blend-mode:screen");
    } finally {
      const idx = GENERATOR_CATALOG.indexOf(testSpec);
      if (idx !== -1) GENERATOR_CATALOG.splice(idx, 1);
    }
  });

  it("the grain is TILED, not full-screen", () => {
    // Measured: full screen costs three times as much (3.3 ms vs 1.1); in
    // 128px tiles it costs nothing measurable.
    const testSpec: GeneratorSpec = {
      id: "probe-with-grain",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" } }
      ],
      schema: [],
      grain: { intensity: 0.25 }
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(renderGenerativeSVG(
        { generatorId: "probe-with-grain", seed: 1 },
        { width: 800, height: 600 }
      ));
      expect(svg).toContain("<pattern");
      expect(svg).toContain('width="128"');
      expect(svg).toContain("feTurbulence");
    } finally {
      const idx = GENERATOR_CATALOG.indexOf(testSpec);
      if (idx !== -1) GENERATOR_CATALOG.splice(idx, 1);
    }
  });

  it("a layer with opacity and blur emits both, and the filter is deduplicated", () => {
    // `luz-difusa`, the first composed generator in the repertoire, is a translucent radial
    // in `screen` BLURRED. No test exercised this branch of the wrapper, and it is the
    // one that generator debuts.
    const testSpec: GeneratorSpec = {
      id: "probe-blur",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" } },
        { primitive: "radial", fixed: { kind: "rings" }, opacity: 0.5, blur: 4 },
        { primitive: "radial", fixed: { kind: "rays" }, blur: 4 }
      ],
      schema: []
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(
        renderGenerativeSVG({ generatorId: "probe-blur", seed: 1 }, { width: 200, height: 200 })
      );

      expect(svg).toContain("opacity:0.5");
      expect(svg).toContain('<feGaussianBlur stdDeviation="4"');

      // Two layers with the same blur share a single <filter>, as gradients already do.
      // Without this, a six-layer generator emits six identical filters.
      // filtros identicos.
      expect(svg.match(/<filter id=/g)).toHaveLength(1);
      expect(svg.match(/filter="url\(#/g)).toHaveLength(2);

      // A layer with blur but no blend or opacity is wrapped anyway, and an empty
      // style must not be invented.
      expect(svg).not.toContain('style=""');
    } finally {
      const idx = GENERATOR_CATALOG.indexOf(testSpec);
      if (idx !== -1) GENERATOR_CATALOG.splice(idx, 1);
    }
  });

  it("a layer without a declared blend emits no mix-blend-mode", () => {
    // So as not to clutter the SVG of single-layer generators.
    const svg = decodeURIComponent(renderGenerativeSVG(
      { generatorId: "stacked-waves", seed: 1 },
      { width: 200, height: 200 }
    ));
    expect(svg).not.toContain("mix-blend-mode");
  });
});
