/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Line breaks in the player's 3D text.
 *
 * The editor and the player paint this text separately. If only the editor
 * were fixed, the author would see two lines and whoever opened the .oim
 * would see one.
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

// The visible text of each `<text>`, without the nested `<textPath>` tags.
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
    // The editor uses `resolveLineHeight` (1.25); the player fell back to 1.2.
    // With one line this was not noticeable; with several, the .oim would
    // come out tighter.
    const model = buildArtisticTextModelFromSlot({ ...slot(), style: {} }, "es");
    expect(model.lineHeight).toBe(1.25);
  });
});
