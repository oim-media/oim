/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The 3D relief of artistic text, now in a single place.
 *
 * The editor and the player each had their own `shadeHexColor`, and they did the
 * opposite: the editor darkened toward black and the player lightened toward
 * white. With the same `#111827`, the author saw an almost black relief and
 * whoever opened the .oim saw it white. The editor's version is kept: it is what
 * the author designed, and what the editor's test claimed but never verified.
 */

import { describe, it, expect } from "vitest";
import { shadeHexColor, calculate3DExtrusionLayers } from "./artisticTextExtrusion.js";

// Sum of the three channels: enough to tell which of two colors is darker.
const luz = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

describe("shadeHexColor", () => {
  it("oscurece hacia el negro", () => {
    expect(shadeHexColor("#808080", 0.5)).toBe("#404040");
  });

  it("acepta colores de tres digitos", () => {
    expect(shadeHexColor("#fff", 0.5)).toBe("#7f7f7f");
  });

  it("deja pasar lo que no es un hexadecimal", () => {
    expect(shadeHexColor("red", 0.5)).toBe("red");
  });
});

describe("calculate3DExtrusionLayers", () => {
  it("con sombreado, cada capa es mas oscura que el color base", () => {
    const base = "#3B82F6";
    const capas = calculate3DExtrusionLayers(15, 90, base, true);
    expect(capas.length).toBeGreaterThan(5);
    for (const capa of capas) expect(luz(capa.color)).toBeLessThan(luz(base));
  });

  it("conserva los colores que el editor venia pintando", () => {
    const capas = calculate3DExtrusionLayers(8, 45, "#111827", true);
    expect(capas[0].color).toBe("#080c13");
    expect(capas[capas.length - 1].color).toBe("#010102");
  });

  it("sin sombreado todas las capas llevan el color base", () => {
    const colores = new Set(calculate3DExtrusionLayers(6, 45, "#FF0000", false).map((c) => c.color));
    expect(colores).toEqual(new Set(["#FF0000"]));
  });

  it("con profundidad 0 no hay capas", () => {
    expect(calculate3DExtrusionLayers(0, 45)).toEqual([]);
  });
});
