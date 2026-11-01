/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { EMBEDDED_FONT_NAME, embeddedFontName } from "./embeddedFonts.js";
import { OimMetadataSchema } from "./schema.js";

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
