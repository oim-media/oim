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

describe("generateArtisticTextSvgString with line breaks", () => {
  it("paints each line in its own text", () => {
    const painted = textos(generateArtisticTextSvgString(buildArtisticTextModelFromSlot(slot(), "es"), "c"));
    expect(painted).toContain("UNO");
    expect(painted).toContain("DOS");
    expect(painted.some((t) => t.includes("\n"))).toBe(false);
  });

  it("also on curved text", () => {
    const painted = textos(generateArtisticTextSvgString(buildArtisticTextModelFromSlot(slot({ curveAmount: 30 }), "es"), "c"));
    expect(painted).toContain("UNO");
    expect(painted).toContain("DOS");
  });

  it("uses the same default line height as the editor", () => {
    // The editor uses `resolveLineHeight` (1.25); the player fell back to 1.2.
    // With one line this was not noticeable; with several, the .oim would
    // come out tighter.
    const model = buildArtisticTextModelFromSlot({ ...slot(), style: {} }, "es");
    expect(model.lineHeight).toBe(1.25);
  });
});

describe("buildArtisticTextModelFromSlot sizes", () => {
  // The exporter writes `fontSize` and the box in cqw of the canvas. The player read cqw
  // against a fixed 800 px canvas, so on a 1200 px canvas the text came out at 2/3 of the
  // size the author set (160 px in the editor, 107 px published).
  it("reads cqw against the real canvas width", () => {
    const exported = { id: "r", type: "artistic-text", width_px: 800, height_px: 220, content: { es: "RETRO" },
      style: { fontSize: "13.3333cqw", width: "66.6667cqw", height: "18.3333cqw" } };
    const m = buildArtisticTextModelFromSlot(exported, "es", 1200);
    expect(m.fontSize).toBeCloseTo(160, 0);
    expect(m.width).toBe(800);
    expect(m.height).toBe(220);
  });

  it("sizes the box from cqw when the exporter left no px box", () => {
    const m = buildArtisticTextModelFromSlot({ id: "r", type: "artistic-text", content: { es: "A" },
      style: { fontSize: "10cqw", width: "50cqw", height: "20cqw" } }, "es", 1000);
    expect(m.width).toBe(500);
    expect(m.height).toBe(200);
    expect(m.fontSize).toBe(100);
  });
});
