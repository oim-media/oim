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
  it("devuelve las entradas validas", () => {
    expect(readEmbeddedFonts({ fonts: [entrada()] })).toHaveLength(1);
  });

  it("ignora un formato, un nombre, un estilo o un contenido que no cuadran", () => {
    const malas = [
      entrada({ format: "ttf" }),
      entrada({ name: "Lora" }),
      entrada({ style: "oblique" }),
      entrada({ data: btoa("NOPE" + "x".repeat(40)) }),
      entrada({ weight: 50 }),
    ];
    expect(readEmbeddedFonts({ fonts: malas })).toEqual([]);
  });

  it("sin fonts no devuelve nada", () => {
    expect(readEmbeddedFonts({ slots: [] })).toEqual([]);
  });
});

describe("registerEmbeddedFonts", () => {
  it("registra cada variante con el nombre interno y su peso y estilo", async () => {
    const add = vi.fn();
    const make = vi.fn((name: string, _src: string, desc: any) => ({ name, desc, load: async () => {} }) as any);
    const mapa = await registerEmbeddedFonts(readEmbeddedFonts({ fonts: [entrada()] }), { add } as any, make);
    expect(make).toHaveBeenCalledWith("oim-3f9a1c2b-Lora", expect.stringContaining("data:font/woff2;base64,"), { weight: "700", style: "italic" });
    expect(add).toHaveBeenCalledTimes(1);
    expect(mapa.get("Lora")).toBe("oim-3f9a1c2b-Lora");
  });

  it("una fuente que no carga se queda fuera y su capa caera a Google", async () => {
    const make = vi.fn(() => ({ load: async () => { throw new Error("rota"); } }) as any);
    const mapa = await registerEmbeddedFonts(readEmbeddedFonts({ fonts: [entrada()] }), { add: vi.fn() } as any, make);
    expect(mapa.size).toBe(0);
  });
});

describe("embeddedFontFamily", () => {
  it("pone el nombre interno primero y la familia real de respaldo", () => {
    expect(embeddedFontFamily("Lora", new Map([["Lora", "oim-3f9a1c2b-Lora"]]))).toBe("'oim-3f9a1c2b-Lora', 'Lora', sans-serif");
  });

  it("una familia no incrustada devuelve null", () => {
    expect(embeddedFontFamily("Inter", new Map())).toBeNull();
  });
});
