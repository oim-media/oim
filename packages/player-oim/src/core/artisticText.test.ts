/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Saltos de linea en el texto 3D del player.
 *
 * El editor y el player pintan este texto por separado. Si solo se arreglara
 * el editor, el autor veria dos lineas y quien abriera el .oim veria una.
 */

import { describe, it, expect } from "vitest";
import { buildArtisticTextModelFromSlot, generateArtisticTextSvgString } from "./artisticText";

const slot = (style: Record<string, unknown> = {}) => ({
  id: "c",
  type: "artistic-text",
  width_px: 400,
  height_px: 200,
  font_size_px: 40,
  content: { es: "UNO\nDOS" },
  style: { lineHeight: 1.25, ...style },
});

// El texto visible de cada `<text>`, sin las etiquetas `<textPath>` de dentro.
const textos = (svg: string) =>
  [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));

describe("generateArtisticTextSvgString con saltos de linea", () => {
  it("pinta cada linea en su propio texto", () => {
    const pintados = textos(generateArtisticTextSvgString(buildArtisticTextModelFromSlot(slot(), "es"), "c"));
    expect(pintados).toContain("UNO");
    expect(pintados).toContain("DOS");
    expect(pintados.some((t) => t.includes("\n"))).toBe(false);
  });

  it("tambien en el texto curvo", () => {
    const pintados = textos(generateArtisticTextSvgString(buildArtisticTextModelFromSlot(slot({ curveAmount: 30 }), "es"), "c"));
    expect(pintados).toContain("UNO");
    expect(pintados).toContain("DOS");
  });

  it("usa el mismo interlineado por defecto que el editor", () => {
    // El editor usa `resolveLineHeight` (1.25); el player caia a 1.2. Con una
    // sola linea no se notaba; con varias, el .oim saldria mas apretado.
    const model = buildArtisticTextModelFromSlot({ ...slot(), style: {} }, "es");
    expect(model.lineHeight).toBe(1.25);
  });
});
