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
    // Añadimos temporalmente un spec de prueba al catálogo para ejercitar la composición
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
    // Medido: a pantalla completa cuesta el triple (3,3 ms contra 1,1); en
    // mosaico de 128 no cuesta nada medible.
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
    // `luz-difusa`, el primer generador compuesto del repertorio, es un radial
    // translucido en `screen` DESENFOCADO. Esta rama del envoltorio no la
    // ejercitaba ninguna prueba, y es la que ese generador estrena.
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

      // Dos layers con el mismo desenfoque comparten un solo <filter>, igual que
      // ya hacen los gradientes. Sin esto, un generador de seis layers emite seis
      // filtros identicos.
      expect(svg.match(/<filter id=/g)).toHaveLength(1);
      expect(svg.match(/filter="url\(#/g)).toHaveLength(2);

      // Una capa con desenfoque pero sin fusion ni opacidad se envuelve igual,
      // y no debe inventarse un style vacio.
      expect(svg).not.toContain('style=""');
    } finally {
      const idx = GENERATOR_CATALOG.indexOf(testSpec);
      if (idx !== -1) GENERATOR_CATALOG.splice(idx, 1);
    }
  });

  it("una capa sin fusion declarada no emite mix-blend-mode", () => {
    // Para no ensuciar el SVG de los generadores de una sola capa.
    const svg = decodeURIComponent(renderGenerativeSVG(
      { generatorId: "stacked-waves", seed: 1 },
      { width: 200, height: 200 }
    ));
    expect(svg).not.toContain("mix-blend-mode");
  });
});
