/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { EMBEDDED_FONT_NAME, embeddedFontName } from "./embeddedFonts.js";
import { OimMetadataSchema } from "./schema.js";

const WOFF2 = Buffer.from("wOF2" + "x".repeat(40)).toString("base64");
const fuente = (cambios: Record<string, unknown> = {}) => ({
  family: "Lora", name: "oim-3f9a1c2b-Lora", weight: 700, style: "italic", format: "woff2", data: WOFF2, ...cambios,
});

describe("embeddedFontName", () => {
  it("usa los 8 primeros hex del hash y la familia", () => {
    expect(embeddedFontName("Lora", "3f9a1c2bdeadbeef")).toBe("oim-3f9a1c2b-Lora");
  });

  it("el nombre que produce cumple el patron", () => {
    expect(EMBEDDED_FONT_NAME.test(embeddedFontName("Noto Sans", "abcdef0123456789"))).toBe(true);
  });

  it("el patron rechaza lo que no sale de embeddedFontName", () => {
    expect(EMBEDDED_FONT_NAME.test("Lora")).toBe(false);
    expect(EMBEDDED_FONT_NAME.test("oim-XYZ-Lora")).toBe(false);
    expect(EMBEDDED_FONT_NAME.test("oim-3f9a1c2b-Lora;color:red")).toBe(false);
  });
});

describe("fonts en la raiz del contrato", () => {
  it("una entrada correcta valida", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [fuente()] }).success).toBe(true);
  });

  it("un formato distinto de woff2 no valida", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [fuente({ format: "ttf" })] }).success).toBe(false);
  });

  it("un nombre fuera del patron no valida", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [fuente({ name: "Lora" })] }).success).toBe(false);
  });

  it("un archivo sin fonts valida igual que antes", () => {
    expect(OimMetadataSchema.safeParse({ slots: [] }).success).toBe(true);
  });
});
