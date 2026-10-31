/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { renderGenerativeSVG } from "./index.js";
import { GENERATOR_CATALOG } from "./catalog.js";
import type { GeneratorSpec } from "./types.js";

describe("generador compuesto por layers", () => {
  it("dos layers emiten dos grupos con su modo de fusion", () => {
    // Temporarily add a test spec to the catalog to exercise the composition
    const testSpec: GeneratorSpec = {
      id: "prueba-dos-layers",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" }, blend: "screen" },
        { primitive: "radial", fixed: { kind: "rays" }, blend: "screen" }
      ],
      schema: []
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(renderGenerativeSVG(
        { generatorId: "prueba-dos-layers", seed: 1 },
        { width: 200, height: 200 }
      ));
      expect(svg.match(/<g style="mix-blend-mode:/g)).toHaveLength(2);
      expect(svg).toContain("mix-blend-mode:screen");
    } finally {
      const idx = GENERATOR_CATALOG.indexOf(testSpec);
      if (idx !== -1) GENERATOR_CATALOG.splice(idx, 1);
    }
  });

  it("el grano va en MOSAICO, no a pantalla completa", () => {
    // Measured: full screen costs three times as much (3.3 ms vs 1.1); in
    // 128px tiles it costs nothing measurable.
    const testSpec: GeneratorSpec = {
      id: "prueba-con-grano",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" } }
      ],
      schema: [],
      grano: { intensidad: 0.25 }
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(renderGenerativeSVG(
        { generatorId: "prueba-con-grano", seed: 1 },
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

  it("una capa con opacidad y desenfoque emite ambos, y el filtro se deduplica", () => {
    // `luz-difusa`, the first composed generator in the repertoire, is a translucent radial
    // in `screen` BLURRED. No test exercised this branch of the wrapper, and it is the
    // one that generator debuts.
    const testSpec: GeneratorSpec = {
      id: "prueba-desenfoque",
      layers: [
        { primitive: "gradient", fixed: { kind: "linear" } },
        { primitive: "radial", fixed: { kind: "rings" }, opacidad: 0.5, desenfoque: 4 },
        { primitive: "radial", fixed: { kind: "rays" }, desenfoque: 4 }
      ],
      schema: []
    };
    GENERATOR_CATALOG.push(testSpec);

    try {
      const svg = decodeURIComponent(
        renderGenerativeSVG({ generatorId: "prueba-desenfoque", seed: 1 }, { width: 200, height: 200 })
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

  it("una capa sin fusion declarada no emite mix-blend-mode", () => {
    // So as not to clutter the SVG of single-layer generators.
    const svg = decodeURIComponent(renderGenerativeSVG(
      { generatorId: "stacked-waves", seed: 1 },
      { width: 200, height: 200 }
    ));
    expect(svg).not.toContain("mix-blend-mode");
  });
});
