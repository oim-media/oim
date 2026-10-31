/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El relieve 3D del texto artistico, ahora en un solo sitio.
 *
 * El editor y el player tenian cada uno su `shadeHexColor`, y hacian lo
 * contrario: el editor oscurecia hacia el negro y el player aclaraba hacia el
 * blanco. Con el mismo `#111827`, el autor veia un relieve casi negro y quien
 * abria el .oim lo veia blanco. Se conserva el del editor: es lo que el autor
 * diseno, y lo que decia la prueba del editor que nunca lo comprobo.
 */

import { describe, it, expect } from "vitest";
import { shadeHexColor, calculate3DExtrusionLayers } from "./artisticTextExtrusion.js";

// Suma de los tres canales: basta para decir cual de dos colores es mas oscuro.
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
