/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { getFillCss } from "../fill.js";
import { gradientCss, paintCss, type PaintColors } from "./paint-css.js";
import { upgrade } from "./upgrade.js";
import { parseCssGradient } from "./upgrade/gradient.js";

const colors: PaintColors = {
  css: (v) => (typeof v === "string" ? v : v && typeof v === "object" && "var" in v ? `var(--oim-v-${(v as { var: string }).var})` : undefined),
  literal: (v) => (typeof v === "string" ? v : "#123456"),
};

describe("gradientCss", () => {
  it.each([
    "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    "linear-gradient(90deg, rgba(0, 0, 0, 0.5) 10%, #fff 90%)",
    "radial-gradient(#fff, #000)",
    "conic-gradient(from 45deg, red 0%, blue 50%, red 100%)",
  ])("writes back what 1.x wrote: %s", (css) => {
    const parsed = parseCssGradient(css)!;
    expect(parseCssGradient(gradientCss(parsed, colors))).toEqual(parsed);
  });

  it("a conic angle is written with `from`, the only form CSS accepts", () => {
    expect(gradientCss({ type: "conic", angle: 45, stops: [{ color: "red" }, { color: "blue" }] }, colors)).toBe("conic-gradient(from 45deg, red, blue)");
  });

  it("a stop bound to a variable becomes a var()", () => {
    expect(gradientCss({ type: "linear", stops: [{ color: { var: "brand" } }, { color: "#000", at: 1 }] }, colors)).toBe(
      "linear-gradient(var(--oim-v-brand), #000 100%)",
    );
  });

  it("a stop with no colour paints no gradient at all", () => {
    expect(gradientCss({ type: "linear", stops: [{ color: 3 }, { color: "#000" }] }, colors)).toBeUndefined();
  });
});

describe("paintCss", () => {
  it("a colour fills the box, or the glyphs of a text", () => {
    expect(paintCss({ kind: "color", value: "#f00" }, { colors })).toEqual({ backgroundColor: "#f00" });
    expect(paintCss({ kind: "color", value: "#f00" }, { colors, isText: true })).toEqual({ color: "#f00" });
  });

  it("the paint's opacity travels with it", () => {
    expect(paintCss({ kind: "color", value: "#f00", opacity: 0.5 }, { colors })).toEqual({ backgroundColor: "#f00", opacity: "0.5" });
  });

  it("a gradient on a text is clipped to the glyphs", () => {
    const css = paintCss({ kind: "gradient", gradient: { type: "linear", stops: [{ color: "#fff" }, { color: "#000" }] } }, { colors, isText: true });
    expect(css).toMatchObject({ backgroundClip: "text", color: "transparent" });
  });

  it("a ref paints its resource; a loop paints nothing", () => {
    const resources = { a: { kind: "color", value: "#0f0" }, loop: { ref: "loop" } } as never;
    expect(paintCss({ ref: "a" }, { colors, resources })).toEqual({ backgroundColor: "#0f0" });
    expect(paintCss({ ref: "loop" }, { colors, resources })).toEqual({});
    expect(paintCss({ ref: "missing" }, { colors, resources })).toEqual({});
  });

  it("a pattern paints exactly what the same 1.x fill painted", () => {
    const style = {
      width: 10, height: 10, fillType: "pattern", fillPatternType: "dots", fillPatternColor: "#ff0000",
      fillPatternBgColor: "#000000", fillPatternScale: 2, fillPatternSpeed: 6, fillPatternDirection: "left",
    };
    const layer = upgrade({ oim: "1.27.9", slots: [{ id: "a", type: "geo", position: [0, 0], style }] }).document.layers[0];
    expect(paintCss(layer.fills![0], { colors })).toEqual(getFillCss({ type: "shape", ...style } as never));
  });

  it("image and texture are left to the renderer", () => {
    expect(paintCss({ kind: "image", src: "data:image/png;base64,x" }, { colors })).toEqual({});
  });
});
