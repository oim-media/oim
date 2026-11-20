/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { typographyCss, type Layer, type PaintColors } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { applyFills } from "./fills.js";
import { applyText, canvasLength } from "./text.js";

// Units the test DOM may not keep (cqw): compare with what the element keeps.
const kept = (value: string, prop: "fontSize" | "maxWidth") => {
  const probe = document.createElement("div");
  probe.style[prop] = value;
  return probe.style[prop];
};

const colors: PaintColors = { css: (v) => (typeof v === "string" ? v : undefined), literal: (v) => (typeof v === "string" ? v : undefined) };
const textLayer = (text: Record<string, unknown>, extra: Partial<Layer> = {}) =>
  ({ id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola" }, ...text }, ...extra }) as Layer;
// The canvas is 800 canvas units wide, so 1 unit is 0.125 % of the canvas.
const paint = (layer: Layer, lang = "es", canvasWidth = 800) => {
  const el = document.createElement("div");
  applyText(el, layer, { lang, canvasWidth });
  return el;
};

describe("applyText", () => {
  it("a language the text lacks shows what 1.x showed: the English, else the Spanish, else the first words", () => {
    expect(paint(textLayer({ content: { es: "09:00" } }), "en").textContent).toBe("09:00");
    expect(paint(textLayer({ content: { es: "Hola", en: "Hi", fr: "" } }), "fr").textContent).toBe("Hi");
    expect(paint(textLayer({ content: { ja: "こんにちは" } }), "de").textContent).toBe("こんにちは");
    expect(paint(textLayer({ content: { es: "Hola", en: "Hi" } }), "es").textContent).toBe("Hola");
  });

  it("the font size is the player's size in canvas units, so it scales with the canvas", () => {
    const layer = textLayer({ font: { size: 42 } });
    expect(typographyCss(layer, "es")!.fontSize).toBe("42px");
    expect(canvasLength("42px", 1000)).toBe("4.2cqw");
    expect(canvasLength("42px", 1600)).toBe("2.625cqw");
    expect(paint(layer, "es", 1000).style.fontSize).toBe(kept("4.2cqw", "fontSize"));
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

  it("the italic room on the right sits outside the box, so its lines centre on the box itself as the player does", () => {
    expect(paint(textLayer({})).style.boxSizing).toBe("content-box");
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
    expect(el.style.maxWidth).toBe(kept("37.5cqw", "maxWidth"));
  });
});

describe("applyText marks, highlight, drop cap and decoration", () => {
  it("a marked run is its own span with the mark's colour", () => {
    const el = paint(textLayer({ content: { es: "Fuente {key}incrustada{/key}" }, marks: { key: { color: "#7c3aed" } } }));
    expect(el.textContent).toBe("Fuente incrustada");
    const span = [...el.querySelectorAll("span")].find((s) => s.textContent === "incrustada");
    expect(span?.style.color).toBe("#7c3aed");
  });

  it("a block highlight paints the full-width body behind the text", () => {
    const el = paint(textLayer({ highlight: { color: "#bae6fd", enabled: true, style: "box" } }));
    const body = el.firstElementChild as HTMLElement;
    expect(body.style.alignSelf).toBe("stretch");
    expect(body.style.background + body.style.backgroundColor + body.style.backgroundImage).toMatch(/186, 230, 253|bae6fd/i);
  });

  it("a drop cap sets the first letter apart", () => {
    const el = paint(textLayer({ content: { es: "Hola mundo" }, dropCap: { enabled: true, lines: 2 } }));
    expect(el.textContent).toBe("Hola mundo");
    expect(el.querySelector("span")?.textContent).toBe("H");
  });

  it("the decoration the file declares is drawn", () => {
    expect(paint(textLayer({ decoration: "underline" })).style.textDecoration).toBe("underline");
  });
});
