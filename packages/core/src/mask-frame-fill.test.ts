/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { maskFrameFillCss } from "./fill";

describe("maskFrameFillCss", () => {
  it("without fillType the frame is a colour from maskBgColor (1.x behaviour)", () => {
    expect(maskFrameFillCss({ maskBgColor: "#ff0000" })).toEqual({ backgroundColor: "#ff0000" });
  });

  it("fillType gradient paints a gradient, same as a shape", () => {
    const css = maskFrameFillCss({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #000, #fff)" });
    expect(css.backgroundImage).toBe("linear-gradient(90deg, #000, #fff)");
  });

  it("a dynamic role keeps the literal colour as its fallback", () => {
    const css = maskFrameFillCss({ fillType: "color", fillColorRole: "primary", fillColor: "#123456" });
    expect(css.backgroundColor).toBe("var(--oim-color-primary, var(--oim-palette-primary, #123456))");
  });

  it("fillType image paints its colour underneath; the photo is painted by the renderers", () => {
    const css = maskFrameFillCss({ fillType: "image", fillColor: "#d4d4d8", fillImage: "data:image/png;base64,aGVsbG8=" });
    expect(css).toEqual({ backgroundColor: "#d4d4d8" });
  });

  it("the legacy maskBgColorRole resolves through the palette, with maskBgColor as fallback", () => {
    const css = maskFrameFillCss({ maskBgColorRole: "primary", maskBgColor: "#123456" });
    expect(css.backgroundColor).toBe("var(--oim-color-primary, var(--oim-palette-primary, #123456))");
  });
});
