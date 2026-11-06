/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { EMBEDDED_FONT_NAME, embeddedFontName, embeddedFontProblem } from "./embeddedFonts.js";
import { OimMetadataSchema, embeddedFontSchema } from "./schema.js";

const WOFF2 = Buffer.from("wOF2" + "x".repeat(40)).toString("base64");
const font = (changes: Record<string, unknown> = {}) => ({
  family: "Lora", name: "oim-3f9a1c2b-Lora", weight: 700, style: "italic", format: "woff2", data: WOFF2, ...changes,
});

describe("embeddedFontName", () => {
  it("uses the first 8 hex digits of the hash and the family", () => {
    expect(embeddedFontName("Lora", "3f9a1c2bdeadbeef")).toBe("oim-3f9a1c2b-Lora");
  });

  it("the name it produces matches the pattern", () => {
    expect(EMBEDDED_FONT_NAME.test(embeddedFontName("Noto Sans", "abcdef0123456789"))).toBe(true);
  });

  it("the pattern rejects anything not produced by embeddedFontName", () => {
    expect(EMBEDDED_FONT_NAME.test("Lora")).toBe(false);
    expect(EMBEDDED_FONT_NAME.test("oim-XYZ-Lora")).toBe(false);
    expect(EMBEDDED_FONT_NAME.test("oim-3f9a1c2b-Lora;color:red")).toBe(false);
  });
});

describe("fonts at the root of the contract", () => {
  it("a correct entry validates", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [font()] }).success).toBe(true);
  });

  it("a format other than woff2 does not validate", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [font({ format: "ttf" })] }).success).toBe(false);
  });

  it("a name outside the pattern does not validate", () => {
    expect(OimMetadataSchema.safeParse({ slots: [], fonts: [font({ name: "Lora" })] }).success).toBe(false);
  });

  it("a file without fonts validates as before", () => {
    expect(OimMetadataSchema.safeParse({ slots: [] }).success).toBe(true);
  });
});

// A minimal WOFF 1: header with one table in the directory, tagged [tag].
function woff(tag: string): Uint8Array {
  const b = new Uint8Array(44 + 20);
  b.set([0x77, 0x4f, 0x46, 0x46]); // wOFF
  new DataView(b.buffer).setUint16(12, 1);
  b.set([...tag].map((c) => c.charCodeAt(0)), 44);
  return b;
}

describe("embeddedFontProblem (1.27.0)", () => {
  it("accepts a static woff and any woff2", () => {
    expect(embeddedFontProblem("woff", woff("glyf"))).toBeNull();
    expect(embeddedFontProblem("woff2", new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0]))).toBeNull();
  });
  it("rejects a variable woff, a wrong magic, a short directory and an unknown format", () => {
    for (const t of ["fvar", "gvar", "avar", "HVAR", "MVAR"]) expect(embeddedFontProblem("woff", woff(t))).toBe("variable");
    // STAT names styles for font menus; static fonts carry it, and HarfBuzz keeps it when instancing.
    expect(embeddedFontProblem("woff", woff("STAT"))).toBeNull();
    expect(embeddedFontProblem("woff", new Uint8Array([0x77, 0x4f, 0x46, 0x32]))).toBe("magic");
    expect(embeddedFontProblem("woff", woff("glyf").subarray(0, 50))).toBe("magic");
    expect(embeddedFontProblem("ttf", woff("glyf"))).toBe("format");
  });
  it("the schema takes woff and woff2 only", () => {
    const base = { family: "Inter", name: "oim-0123abcd-Inter", weight: 700, style: "normal", data: "d09GRg==" };
    expect(embeddedFontSchema.safeParse({ ...base, format: "woff" }).success).toBe(true);
    expect(embeddedFontSchema.safeParse({ ...base, format: "woff2" }).success).toBe(true);
    expect(embeddedFontSchema.safeParse({ ...base, format: "ttf" }).success).toBe(false);
  });
});
