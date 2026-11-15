/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { typographyCss, type Layer, type PaintColors } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { applyFills } from "./fills.js";
import { applyText } from "./text.js";

const colors: PaintColors = { css: (v) => (typeof v === "string" ? v : undefined), literal: (v) => (typeof v === "string" ? v : undefined) };
const textLayer = (text: Record<string, unknown>, extra: Partial<Layer> = {}) =>
  ({ id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola" }, ...text }, ...extra }) as Layer;
const paint = (layer: Layer, lang = "es") => {
  const el = document.createElement("div");
  applyText(el, layer, { lang });
  return el;
};

describe("applyText", () => {
  it("the font size is the one the player writes for the same text, in canvas px", () => {
    const layer = textLayer({ font: { size: 42 } });
    expect(paint(layer).style.fontSize).toBe(typographyCss(layer, "es")!.fontSize);
    expect(paint(layer).style.fontSize).toBe("42px");
  });

  it("a gradient fill on a text clips the gradient to its letters", () => {
    const layer = textLayer({}, { fills: [{ kind: "gradient", gradient: { type: "linear", angle: 90, stops: [{ color: "#000" }, { color: "#fff" }] } }] } as Partial<Layer>);
    const el = document.createElement("div");
    applyFills(el, layer, { colors, isText: true });
    expect(el.style.backgroundImage).toContain("linear-gradient");
    expect(el.style.color).toBe("transparent");
  });

  it("an empty text does not break", () => {
    const el = paint(textLayer({ content: { es: "" } }));
    expect(el.textContent).toBe("");
  });

  it("the text is set as plain text, never as markup", () => {
    expect(paint(textLayer({ content: { es: "<b>Hola</b>" } })).textContent).toBe("<b>Hola</b>");
  });

  it("the words are those of the language, and a text keeps the player's defaults", () => {
    const layer = textLayer({ content: { es: "Hola", en: "Hi" } });
    const el = paint(layer, "en");
    expect(el.textContent).toBe("Hi");
    expect(el.style.whiteSpace).toBe("pre-wrap");
    expect(el.style.textAlign).toBe("left");
    expect(el.style.maxWidth).toBe("80%");
  });

  it("a text sits in the middle of its box's height, and its alignment places the lines across the width", () => {
    const el = paint(textLayer({ align: "right" }, { box: { x: 0, y: 0, width: 300, height: 100 } } as Partial<Layer>));
    expect(el.style.display).toBe("flex");
    expect(el.style.flexDirection).toBe("column");
    expect(el.style.justifyContent).toBe("center");
    expect(el.style.alignItems).toBe("flex-end");
  });

  it("a stated alignment and maximum width replace the defaults", () => {
    const el = paint(textLayer({ align: "center", maxWidth: 300 }));
    expect(el.style.textAlign).toBe("center");
    expect(el.style.maxWidth).toBe("300px");
  });
});
