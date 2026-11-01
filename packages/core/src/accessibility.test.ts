/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { styleSchema, OimMetadataSchema } from "./schema.js";

describe("screen-reader accessibility (contract 1.16.0)", () => {
  it("a layer carries alt text per language and a decorative flag", () => {
    const r = styleSchema.safeParse({ alt: { es: "Un gato", en: "A cat" }, decorative: false });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ alt: { es: "Un gato", en: "A cat" }, decorative: false });
  });

  it("alt text is capped at 300 characters", () => {
    expect(styleSchema.safeParse({ alt: { es: "x".repeat(300) } }).success).toBe(true);
    expect(styleSchema.safeParse({ alt: { es: "x".repeat(301) } }).success).toBe(false);
  });

  it("the document description is capped at 1000 characters", () => {
    const r = OimMetadataSchema.safeParse({ slots: [], description: { es: "y".repeat(1000) } });
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty("description.es");
    expect(OimMetadataSchema.safeParse({ slots: [], description: { es: "y".repeat(1001) } }).success).toBe(false);
  });

  it("a 1.15.0 document without the fields still parses", () => {
    expect(OimMetadataSchema.safeParse({ version: "1.15.0", slots: [] }).success).toBe(true);
    expect(styleSchema.safeParse({ opacity: 1 }).success).toBe(true);
  });
});
