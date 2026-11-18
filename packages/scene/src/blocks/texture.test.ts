/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { paintColors } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { TEXTURE_CATALOG } from "../../../core/src/effects/catalog.js";
import { applyTextureEffect } from "./texture.js";

const ctx = (text: boolean) => ({ text, under: { kind: "color", value: "#ff0000" }, colors: paintColors({}), lineHeight: 1.2, mask: { type: text ? "text" : "shape" }, len: (px: number) => `${px / 10}cqw` });

describe("applyTextureEffect", () => {
  it("a shape gets an overlay of the catalogue tile, scaled in the painter's lengths, blended and as strong as its intensity", () => {
    const el = document.createElement("div");
    applyTextureEffect(el, { kind: "texture", preset: "vintage-paper", intensity: 40, blend: "multiply", scale: 2 }, ctx(false));
    const overlay = el.querySelector<HTMLElement>(".oim-effect-texture")!;
    const def = TEXTURE_CATALOG["vintage-paper"];
    expect(overlay.style.opacity).toBe("0.4");
    expect(overlay.style.mixBlendMode).toBe("multiply");
    expect(overlay.style.backgroundSize).toBe(`${(def.tileWidth * 2) / 10}cqw ${(def.tileHeight * 2) / 10}cqw`);
  });

  it("a text takes the tile inside its glyphs, over its own colour", () => {
    const el = document.createElement("div");
    applyTextureEffect(el, { kind: "texture", preset: "halftone-dots" }, ctx(true));
    expect(el.children.length).toBe(0);
    expect(el.style.backgroundImage).toContain("linear-gradient(");
    expect(el.style.color).toBe("transparent");
  });

  it("an unknown preset paints nothing", () => {
    const el = document.createElement("div");
    applyTextureEffect(el, { kind: "texture", preset: "nope" } as never, ctx(false));
    expect(el.children.length).toBe(0);
  });
});
