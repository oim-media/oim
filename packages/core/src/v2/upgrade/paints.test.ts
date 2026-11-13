/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { upgrade } from "../upgrade.js";
import { parseCssGradient } from "./gradient.js";

const doc = (style: object, type = "geo", root: object = {}) => ({
  oim: "1.27.9",
  canvas: { natural_width: 1000, natural_height: 1000 },
  slots: [{ id: "a", type, position: [0, 0], style: { width: 10, height: 10, ...style } }],
  ...root,
});
const layer = (style: object, type?: string, root?: object) => upgrade(doc(style, type, root)).document.layers[0];
const palettes = { palettes: { day: { accent: "#ff0000" } } };

describe("parseCssGradient", () => {
  it("reads the gradients the editor writes", () => {
    expect(parseCssGradient("linear-gradient(135deg, #764ba2 0%, #667eea 100%)")).toEqual({
      type: "linear",
      angle: 135,
      stops: [{ color: "#764ba2", at: 0 }, { color: "#667eea", at: 1 }],
    });
    expect(parseCssGradient("linear-gradient(to right, #000, rgba(0, 0, 0, 0.5) 50%, #fff)")).toEqual({
      type: "linear",
      angle: 90,
      stops: [{ color: "#000" }, { color: "rgba(0, 0, 0, 0.5)", at: 0.5 }, { color: "#fff" }],
    });
    expect(parseCssGradient("radial-gradient(circle, #fff 0%, #000 100%)")?.type).toBe("radial");
    expect(parseCssGradient("conic-gradient(from 90deg, #f00, #00f)")).toMatchObject({ type: "conic", angle: 90 });
  });

  it("refuses what it does not understand", () => {
    for (const css of ["", "url(x.png)", "linear-gradient(90deg, #000", "linear-gradient(90deg, #000)", "linear-gradient(90deg, url(x), #000)", "linear-gradient(90deg, rgb(0, 0, 0, #fff)", 3, null]) {
      expect(parseCssGradient(css), String(css)).toBeNull();
    }
  });
});

describe("fills", () => {
  it("a colour, with or without fillType", () => {
    expect(layer({ fillColor: "#112233" }).fills).toEqual([{ kind: "color", value: "#112233" }]);
    expect(layer({ fillType: "color", fillColor: "#112233" }).fills).toEqual([{ kind: "color", value: "#112233" }]);
  });

  it("no fill: none, transparent or nothing", () => {
    expect(layer({ fillType: "none", fillColor: "#112233" })).not.toHaveProperty("fills");
    expect(layer({ fillColor: "transparent" })).not.toHaveProperty("fills");
    expect(layer({})).not.toHaveProperty("fills");
  });

  it("a gradient becomes structured, and one it cannot read is reported", () => {
    expect(layer({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #3B82F6 0%, #9333EA 100%)" }).fills).toEqual([
      { kind: "gradient", gradient: { type: "linear", angle: 90, stops: [{ color: "#3B82F6", at: 0 }, { color: "#9333EA", at: 1 }] } },
    ]);
    const broken = upgrade(doc({ fillType: "gradient", fillGradient: "url(evil)" }));
    expect(broken.unhandled).toEqual(["style.fillGradient: gradient not understood"]);
  });

  it("an image fill keeps its crop and flip", () => {
    const crop = { x: 50, y: 88, zoom: 1.1 };
    expect(layer({ fillType: "image", fillImage: "data:image/png;base64,AA", fillImageCrop: crop, fillImageFlipX: true }).fills).toEqual([
      { kind: "image", src: "data:image/png;base64,AA", crop, flipX: true },
    ]);
  });

  it("a pattern, from fillPattern* or from backgroundPattern*", () => {
    expect(layer({ fillType: "pattern", fillPatternType: "dots", fillPatternColor: "#a3e635", fillPatternBgColor: "transparent", fillPatternScale: 1.5 }).fills).toEqual([
      { kind: "pattern", pattern: { preset: "dots", colors: ["#a3e635"], scale: 1.5 } },
    ]);
    expect(layer({ backgroundType: "pattern", backgroundPatternType: "stripes", backgroundPatternColor: "#000", backgroundPatternBgColor: "#fff", backgroundPatternDirection: "up", backgroundPatternSpeed: 2 }).fills).toEqual([
      { kind: "pattern", pattern: { preset: "stripes", colors: ["#000"], bg: "#fff", motion: { direction: "up", period: 2 } } },
    ]);
  });

  it("the CSS animation of a moving pattern becomes its motion", () => {
    const result = upgrade(doc({ backgroundType: "pattern", backgroundPatternType: "waves", cssAnimation: "background-animation-left 3s linear infinite" }));
    expect(result.document.layers[0].fills).toEqual([{ kind: "pattern", pattern: { preset: "waves", motion: { direction: "left", period: 3 } } }]);
    expect(result.unhandled).toEqual([]);
  });

  it("a generative fill travels as it is", () => {
    const generative = { generatorId: "stacked", colors: { stops: ["#000", "#fff"] } };
    expect(layer({ fillType: "generative", fillGenerative: generative }).fills).toEqual([{ kind: "generative", generative }]);
  });

  it("a role binds only when the document has a palette that defines it", () => {
    expect(layer({ fillColor: "#112233", fillColorRole: "accent" }, "geo", palettes).fills).toEqual([{ kind: "color", value: { var: "accent" } }]);
    expect(layer({ fillColor: "#112233", fillColorRole: "accent" }).fills).toEqual([{ kind: "color", value: "#112233" }]);
    expect(layer({ fillColor: "#112233", fillColorRole: "surface" }, "geo", palettes).fills).toEqual([{ kind: "color", value: "#112233" }]);
  });

  it("the colour of a text is its fill", () => {
    expect(layer({ fillColor: "#ffffff" }, "text").fills).toEqual([{ kind: "color", value: "#ffffff" }]);
    expect(layer({ textGradientType: "sunset-gold", fillColor: "#fff" }, "text").fills).toEqual([{ kind: "gradient", preset: "sunset-gold" }]);
  });

  it("a layer type that admits no fill drops the noise without reporting it", () => {
    const result = upgrade(doc({ fillColor: "#FFFFFF", fillType: "color" }, "group"));
    expect(result.document.layers[0]).not.toHaveProperty("fills");
    expect(result.unhandled).toEqual([]);
  });
});

describe("strokes", () => {
  it("a stroke needs a width: the default colour alone paints nothing", () => {
    expect(layer({ strokeColor: "#1F1714", strokeWidth: 2, strokeStyle: "solid" }).strokes).toEqual([{ paint: { kind: "color", value: "#1F1714" }, width: 2 }]);
    expect(layer({ strokeColor: "#1F1714", strokeWidth: 0 })).not.toHaveProperty("strokes");
    expect(layer({ textStrokeColor: "#18181B" }, "text")).not.toHaveProperty("strokes");
  });

  it("dashed and dotted are kept, solid is the default", () => {
    expect(layer({ strokeColor: "#000", strokeWidth: 1, strokeStyle: "dashed" }).strokes?.[0].style).toBe("dashed");
  });

  it("text outline, outer and inner strokes are all strokes", () => {
    expect(layer({ textStrokeColor: "#e8ff00", textStrokeWidth: 3 }, "text").strokes).toEqual([{ paint: { kind: "color", value: "#e8ff00" }, width: 3 }]);
    expect(layer({ outerStrokeColor: "#000", outerStrokeWidth: 4, innerStrokeColor: "#fff", innerStrokeWidth: 1 }, "artistic-text").strokes).toEqual([
      { paint: { kind: "color", value: "#000" }, width: 4, align: "outside" },
      { paint: { kind: "color", value: "#fff" }, width: 1, align: "inside" },
    ]);
  });

  it("the undeclared borderColor and borderWidth are a stroke too", () => {
    expect(layer({ borderColor: "#111111", borderWidth: 4 }).strokes).toEqual([{ paint: { kind: "color", value: "#111111" }, width: 4 }]);
  });
});

describe("the background of the canvas", () => {
  const canvas = (root: object) => upgrade({ oim: "1.27.9", canvas: { natural_width: 1000, natural_height: 1000 }, slots: [], ...root });

  it("a colour", () => {
    expect(canvas({ backgroundType: "color", backgroundColor: "#F6F1E7" }).document.canvas.fills).toEqual([{ kind: "color", value: "#F6F1E7" }]);
  });

  it("the gradient fields that only repeat the string are dropped with it", () => {
    const result = canvas({
      backgroundType: "color", backgroundColor: "#FFFFFF",
      backgroundGradient: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
      backgroundGradientAngle: 135, backgroundGradientStart: "#764ba2", backgroundGradientEnd: "#667eea", backgroundGradientType: "linear",
    });
    expect(result.document.canvas.fills).toEqual([{ kind: "color", value: "#FFFFFF" }]);
    expect(result.unhandled).toEqual([]);
  });

  it("a gradient, when the type says so", () => {
    expect(canvas({ backgroundType: "gradient", backgroundGradient: "linear-gradient(135deg, #1c1917 0%, #44403c 100%)" }).document.canvas.fills?.[0]).toMatchObject({ kind: "gradient", gradient: { angle: 135 } });
  });

  it("a pattern, with the singular Count and Dispersion the canvas wrote", () => {
    const result = canvas({
      backgroundType: "pattern", backgroundPatternType: "stars", backgroundPatternColor: "#1d4ed8", backgroundPatternBgColor: "#fde68a",
      backgroundPatternScale: 1.5, backgroundPatternSpeed: 0, backgroundPatternDirection: "none",
      backgroundPatternCount: [15], backgroundPatternDispersion: [50], backgroundPatternSizes: [100], backgroundPatternSvgs: null, backgroundPatternColors: null,
    });
    expect(result.document.canvas.fills).toEqual([
      { kind: "pattern", pattern: { preset: "stars", colors: ["#1d4ed8"], bg: "#fde68a", scale: 1.5, sizes: [100], counts: [15], dispersions: [50] } },
    ]);
    expect(result.unhandled).toEqual([]);
  });

  it("the texture, whose keys were in Spanish, is a second paint", () => {
    const backgroundTexture = { tipo: "lineas", color: "#1F1714", angulo: 0, cruzada: true, grosor: 1.5, opacidad: 0.12, tamano: 50 };
    expect(canvas({ backgroundType: "color", backgroundColor: "#fff", backgroundTexture }).document.canvas.fills).toEqual([
      { kind: "color", value: "#fff" },
      { kind: "texture", texture: { type: "lineas", color: "#1F1714", angle: 0, crossed: true, thickness: 1.5, size: 50 }, opacity: 0.12 },
    ]);
  });

  it("no background at all leaves the canvas as it was", () => {
    expect(canvas({}).document.canvas).toEqual({ width: 1000, height: 1000 });
  });
});
