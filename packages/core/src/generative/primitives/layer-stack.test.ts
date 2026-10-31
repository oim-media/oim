/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { renderLayerStack } from "./layer-stack.js";
import { createRng } from "../rng.js";
import { createDefsRegistry } from "../svg.js";
import { RenderContext } from "../types.js";

function createMockContext(width = 900, height = 600, bleed = 2): RenderContext {
  return {
    width,
    height,
    bleed,
    rng: createRng(42),
    defs: createDefsRegistry(),
    ramp: (i, total) => `#${i}${i}${i}${i}${i}${i}`
  };
}

describe("LayerStack Primitive (primitives/layer-stack.ts)", () => {
  /** Extrae los pares de coordenadas de cada atributo `d` en orden de aparición. */
  function extractPathPoints(markup: string): Array<Array<[number, number]>> {
    return (markup.match(/d="([^"]+)"/g) || []).map((attr) => {
      const nums = (attr.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const points: Array<[number, number]> = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push([nums[i], nums[i + 1]]);
      }
      return points;
    });
  }

  // Este es EL invariante del modo `shared`: la capa N cierra regresando por los
  // puntos exactos de la N−1, desplazados por el sangrado. Si se rompe aparecen
  // fisuras o solapes aleatorios entre layers — el defecto visual más visible, y
  // el que regresa en silencio. Contar <path> no lo detecta.
  it("closes each shared layer along the previous layer's exact points", () => {
    const ctx = createMockContext();
    const bleed = 2;
    const markup = renderLayerStack(
      {
        layers: 3,
        boundary: "shared",
        interpolation: "peak",
        anchor: "bottom"
      },
      ctx
    );

    const layers = extractPathPoints(markup);
    expect(layers).toHaveLength(3);

    // La capa 0 cierra contra el marco: sus 2 últimos pares son el borde.
    const pointsPerLayer = layers[0].length - 2;
    expect(pointsPerLayer).toBeGreaterThan(1);

    for (let l = 1; l < layers.length; l++) {
      const forwardOfPrevious = layers[l - 1].slice(0, pointsPerLayer);
      const returnOfCurrent = layers[l].slice(-pointsPerLayer).reverse();

      expect(returnOfCurrent).toHaveLength(forwardOfPrevious.length);

      returnOfCurrent.forEach(([x, y], i) => {
        const [prevX, prevY] = forwardOfPrevious[i];
        expect(x).toBeCloseTo(prevX, 6);
        // anchor 'bottom' desplaza el retorno hacia abajo exactamente el sangrado
        expect(y).toBeCloseTo(prevY + bleed, 6);
      });
    }
  });

  it("does not reuse the previous layer's points when boundary is independent", () => {
    const ctx = createMockContext();
    const markup = renderLayerStack(
      { layers: 3, boundary: "independent", interpolation: "peak", anchor: "bottom" },
      ctx
    );

    const layers = extractPathPoints(markup);
    // Cada capa cierra con los 2 puntos del marco, no con una vuelta completa.
    for (const layer of layers) {
      expect(layer[layer.length - 1]).toEqual([0, 602]);
      expect(layer[layer.length - 2]).toEqual([900, 602]);
    }
  });

  it("closes independent boundaries to the canvas frame edge", () => {
    const ctx = createMockContext();
    const markup = renderLayerStack(
      {
        layers: 2,
        boundary: "independent",
        anchor: "bottom"
      },
      ctx
    );

    expect(markup).toContain("L 900 602 L 0 602 Z");
  });

  it("supports all 5 interpolations (wave, peak, step, zigzag, chevron)", () => {
    const ctx = createMockContext();
    const interpolations = ["wave", "peak", "step", "zigzag", "chevron"] as const;

    for (const interp of interpolations) {
      const markup = renderLayerStack(
        {
          layers: 2,
          interpolation: interp
        },
        ctx
      );
      expect(markup).toContain("<path");
      expect(markup).not.toBeNaN();
    }
  });

  it("supports all 4 anchors (bottom, top, left, right)", () => {
    const ctx = createMockContext();
    const anchors = ["bottom", "top", "left", "right"] as const;

    for (const anchor of anchors) {
      const markup = renderLayerStack(
        {
          layers: 2,
          anchor
        },
        ctx
      );
      expect(markup).toContain("<path");
    }
  });
});
