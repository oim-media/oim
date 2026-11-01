/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { styleSchema } from "./schema.js";
import { minVersionFor, PLAYER_CAPABILITIES } from "./compatibility.js";

describe("image fill in shapes (contract 1.17.0)", () => {
  it("accepts a shape filled with an image and a crop", () => {
    const r = styleSchema.safeParse({
      fillType: "image",
      fillImage: "data:image/png;base64,iVBORw0KGgo=",
      fillImageCrop: { x: 20, y: 70, zoom: 2 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a crop zoom above 10 and a negative x", () => {
    expect(styleSchema.safeParse({ fillImageCrop: { x: 20, y: 70, zoom: 11 } }).success).toBe(false);
    expect(styleSchema.safeParse({ fillImageCrop: { x: -1, y: 0, zoom: 1 } }).success).toBe(false);
  });

  it("accepts an embedded data:image picture as fillImage", () => {
    expect(styleSchema.safeParse({ fillImage: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(true);
  });

  it("rejects a fillImage that is not an embedded data:image", () => {
    expect(styleSchema.safeParse({ fillImage: "oim-r2:u/h" }).success).toBe(false);
    expect(styleSchema.safeParse({ fillImage: "https://example.com/a.png" }).success).toBe(false);
    expect(styleSchema.safeParse({ fillImage: "javascript:alert(1)" }).success).toBe(false);
  });

  it("a 1.16.0 style without the fill fields still validates", () => {
    expect(styleSchema.safeParse({ fillType: "color", fillColor: "#ffffff" }).success).toBe(true);
  });

  it("declares image_fill as a player capability needing 1.17.0", () => {
    expect(PLAYER_CAPABILITIES).toContain("image_fill");
    expect(minVersionFor({ capabilities: ["image_fill"] })).toBe("1.17.0");
  });
});

describe("fillImage prefix is case-sensitive, as the generated JSON Schema is", () => {
  it("rejects an upper-case DATA:IMAGE/ prefix, the same as the JSON Schema pattern", () => {
    expect(styleSchema.safeParse({ fillImage: "DATA:IMAGE/png;base64,iVBORw0KGgo=" }).success).toBe(false);
  });
});
