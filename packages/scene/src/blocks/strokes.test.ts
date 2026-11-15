/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { applyStrokes, strokeCss } from "./strokes.js";

const colors = { css: (v: unknown) => (typeof v === "string" ? v : undefined), literal: (v: unknown) => (typeof v === "string" ? v : undefined) };
const stroke = (o: Record<string, unknown> = {}) => ({ paint: { kind: "color", value: "#f00" }, width: 2, ...o }) as NonNullable<Layer["strokes"]>[number];
const paint = (strokes: Layer["strokes"], isText = false) => {
  const el = document.createElement("div");
  applyStrokes(el, { strokes }, { colors, isText });
  return el;
};
// The CSS of a stroke, not the element's style: the test DOM does not keep every property (-webkit-text-stroke).
const css = (strokes: Layer["strokes"], isText = false) => strokeCss({ strokes }, { colors, isText });

describe("applyStrokes", () => {
  it("a centred stroke of 2 px is a border of the same width, colour and style as the player writes", () => {
    expect(paint([stroke()]).style.border).toBe("2px solid #f00");
  });

  it("dashed and dotted styles reach the border", () => {
    expect(paint([stroke({ style: "dashed" })]).style.border).toBe("2px dashed #f00");
  });

  it("an inside or outside stroke is a box shadow on the inner or outer edge", () => {
    expect(paint([stroke({ align: "inside" })]).style.boxShadow).toBe("inset 0 0 0 2px #f00");
    expect(paint([stroke({ align: "outside" })]).style.boxShadow).toBe("0 0 0 2px #f00");
  });

  it("a text's stroke outlines its letters", () => {
    expect(css([stroke()], true)).toEqual({ WebkitTextStroke: "2px #f00" });
  });

  it("a stroke whose paint is missing or not a colour draws nothing", () => {
    expect(css([stroke({ paint: { ref: "nope" } })])).toEqual({});
  });

  it("applying again replaces the earlier stroke", () => {
    const el = paint([stroke()]);
    applyStrokes(el, { strokes: [stroke({ width: 4 })] }, { colors, isText: false });
    expect(el.style.border).toBe("4px solid #f00");
  });
});
