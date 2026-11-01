/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import { readEmbeddedFonts, registerEmbeddedFonts, embeddedFontFamily } from "./embeddedFonts";

const WOFF2 = btoa("wOF2" + "x".repeat(40));
const entrada = (cambios: Record<string, unknown> = {}) => ({
  family: "Lora", name: "oim-3f9a1c2b-Lora", weight: 700, style: "italic", format: "woff2", data: WOFF2, ...cambios,
});

describe("readEmbeddedFonts", () => {
  it("returns the valid entries", () => {
    expect(readEmbeddedFonts({ fonts: [entrada()] })).toHaveLength(1);
  });

  it("ignores an entry whose format, name, style or content does not match", () => {
    const malas = [
      entrada({ format: "ttf" }),
      entrada({ name: "Lora" }),
      entrada({ style: "oblique" }),
      entrada({ data: btoa("NOPE" + "x".repeat(40)) }),
      entrada({ weight: 50 }),
    ];
    expect(readEmbeddedFonts({ fonts: malas })).toEqual([]);
  });

  it("without fonts it returns nothing", () => {
    expect(readEmbeddedFonts({ slots: [] })).toEqual([]);
  });
});

describe("registerEmbeddedFonts", () => {
  it("registers each variant with its internal name and its weight and style", async () => {
    const add = vi.fn();
    const make = vi.fn((name: string, _src: string, desc: any) => ({ name, desc, load: async () => {} }) as any);
    const mapa = await registerEmbeddedFonts(readEmbeddedFonts({ fonts: [entrada()] }), { add } as any, make);
    expect(make).toHaveBeenCalledWith("oim-3f9a1c2b-Lora", expect.stringContaining("data:font/woff2;base64,"), { weight: "700", style: "italic" });
    expect(add).toHaveBeenCalledTimes(1);
    expect(mapa.get("Lora")).toBe("oim-3f9a1c2b-Lora");
  });

  it("a font that does not load is left out and its layer falls back to Google", async () => {
    const make = vi.fn(() => ({ load: async () => { throw new Error("rota"); } }) as any);
    const mapa = await registerEmbeddedFonts(readEmbeddedFonts({ fonts: [entrada()] }), { add: vi.fn() } as any, make);
    expect(mapa.size).toBe(0);
  });
});

describe("embeddedFontFamily", () => {
  it("puts the internal name first and the real family as fallback", () => {
    expect(embeddedFontFamily("Lora", new Map([["Lora", "oim-3f9a1c2b-Lora"]]))).toBe("'oim-3f9a1c2b-Lora', 'Lora', sans-serif");
  });

  it("a non-embedded family returns null", () => {
    expect(embeddedFontFamily("Inter", new Map())).toBeNull();
  });
});
