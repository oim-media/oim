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

  // Ruling (13 Nov): a role binds with its literal as fallback, palettes or not,
  // because a host page can set the dynamic roles; 1.x painted var(--oim-color-<role>, literal).
  it("a known role binds and keeps its literal as the fallback", () => {
    expect(layer({ fillColor: "#112233", fillColorRole: "accent" }, "geo", palettes).fills).toEqual([{ kind: "color", value: { var: "accent", fallback: "#112233" } }]);
    expect(layer({ fillColor: "#112233", fillColorRole: "surface" }).fills).toEqual([{ kind: "color", value: { var: "surface", fallback: "#112233" } }]);
    expect(layer({ fillColorRole: "surface" }).fills).toEqual([{ kind: "color", value: { var: "surface" } }]);
  });

  it("colorRole is the role of fillColor when fillColorRole is absent, as 1.x painted it", () => {
    expect(layer({ fillColor: "#18181B", colorRole: "on-surface" }, "text").fills).toEqual([{ kind: "color", value: { var: "on-surface", fallback: "#18181B" } }]);
  });

  it("`color`, retired in 1.5.0, paints nothing", () => {
    expect(layer({ color: "#ff0000" }, "text")).not.toHaveProperty("fills");
  });

  it("an unknown role with no palette defining it keeps only the literal", () => {
    expect(layer({ fillColor: "#112233", fillColorRole: "brand" }).fills).toEqual([{ kind: "color", value: "#112233" }]);
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

  // Ruling (13 Nov): on a text the strokes are the letters' outline; the box
  // border 1.x drew for strokeColor on a text has no 2.0 meaning and is dropped.
  it("a text stroke is black by default, under strokeColorRole when it has no role of its own", () => {
    expect(layer({ textStrokeWidth: 2 }, "text").strokes).toEqual([{ paint: { kind: "color", value: "#000000" }, width: 2 }]);
    expect(layer({ textStrokeWidth: 2, textStrokeColor: "#111111", strokeColorRole: "outline" }, "text").strokes)
      .toEqual([{ paint: { kind: "color", value: { var: "outline", fallback: "#111111" } }, width: 2 }]);
    expect(layer({ strokeColor: "#0000ff", strokeWidth: 3 }, "text")).not.toHaveProperty("strokes");
  });

  // Ruling (13 Nov): 1.x never painted these without a border-style (golden
  // strokes-and-borders), so they become a stroke only when one makes them visible.
  it("borderColor and borderWidth paint nothing without a visible borderStyle", () => {
    expect(layer({ borderColor: "#111111", borderWidth: 4 })).not.toHaveProperty("strokes");
    expect(layer({ borderColor: "#111111", borderWidth: 4, borderStyle: "dashed" }).strokes).toEqual([{ paint: { kind: "color", value: "#111111" }, width: 4, style: "dashed" }]);
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

describe("1.x shapes whose fill the player read through fallbacks", () => {
  const IMG = "data:image/png;base64,iVBORw0KGgo=";
  it("a photo keeps its fillColor under it, for when it does not load", () => {
    expect(layer({ fillType: "image", fillImage: IMG, fillColor: "#ff0000" }).fills).toEqual([
      expect.objectContaining({ kind: "image", src: IMG }),
      { kind: "color", value: "#ff0000" },
    ]);
    expect(layer({ fillType: "image", fillImage: IMG }).fills).toHaveLength(1);
  });

  it("a scribble with no stroke gets 2 px in its fill colour, and no fill", () => {
    const l = layer({ geoShape: "scribble", fillColor: "#00ff00", customBlobPath: "M 0 0 L 10 10" });
    expect(l.fills).toBeUndefined();
    expect(l.strokes?.[0]).toMatchObject({ width: 2, paint: { kind: "color", value: "#00ff00" } });
  });

  it("a custom path takes no colour fill", () => {
    expect(layer({ svgPath: "M 0 0 L 10 10 Z", fillColor: "#00ff00" }).fills).toBeUndefined();
  });
});

describe("1.x patterns", () => {
  const pattern = (style: object, type?: string, root?: object) => (layer(style, type, root).fills?.[0] as any)?.pattern;
  it("a raw SVG tile keeps the colours it is recoloured with, without a preset", () => {
    expect(pattern({ backgroundType: "pattern", fillPatternColor: "#ff0000" })).toEqual({ colors: ["#ff0000"] });
  });
  it("a pattern layer with no fillType is a pattern", () => {
    expect(pattern({ fillPatternType: "dots" }, "pattern")).toEqual({ preset: "dots" });
  });
  it("the role of the single colour tints the first of the list", () => {
    expect(pattern({ fillType: "pattern", fillPatternType: "dots", fillPatternColor: "#a3e635", fillPatternColorRole: "accent", fillPatternColors: ["#a3e635", "#38bdf8"] }, "geo", palettes).colors)
      .toEqual([{ var: "accent", fallback: "#a3e635" }, "#38bdf8"]);
  });
  it("a canvas tile keeps its cover fit and moves at 8 s when given only a direction", () => {
    expect(pattern({ backgroundType: "pattern", backgroundPatternType: "dots", backgroundFit: "cover", backgroundPatternDirection: "left" }))
      .toMatchObject({ fit: "cover", motion: { direction: "left", period: 8 } });
  });
});

describe("1.x SVG layers", () => {
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>';
  const svgLayer = (style: object, type = "svg") =>
    upgrade({ oim: "1.27.9", canvas: { natural_width: 1000, natural_height: 1000 }, slots: [{ id: "a", type, position: [0, 0], content: { es: ICON }, style: { width: 10, height: 10, ...style } }] } as never).document.layers[0] as any;

  it("strokeColor tints the drawing at any width: a colour-only stroke", () => {
    expect(svgLayer({ strokeColor: "#2563EB", strokeWidth: 2 }).strokes).toEqual([{ paint: { kind: "color", value: "#2563EB" }, width: 0 }]);
  });
  it("an old icon created as geo is a drawing too", () => {
    const l = svgLayer({ strokeColor: "#2563EB" }, "geo");
    expect(l.geometry.kind).toBe("paths");
    expect(l.strokes?.[0].width).toBe(0);
  });
  it("fillColor paints every figure: each fill links to the layer", () => {
    expect(svgLayer({ fillColor: "#00ff00" }).geometry.paths.map((p: any) => p.fill)).toEqual(["currentColor"]);
    expect(svgLayer({ fillColor: "transparent" }).geometry.paths[0].fill).toBeUndefined();
  });
  it("an svg layer whose drawing is in svgRawXml is tinted too", () => {
    const l = upgrade({ oim: "1.27.9", canvas: { natural_width: 1000, natural_height: 1000 }, slots: [{ id: "a", type: "svg", position: [0, 0], style: { width: 10, height: 10, strokeColor: "#2563EB", svgRawXml: ICON } }] } as never).document.layers[0] as any;
    expect(l.strokes).toEqual([{ paint: { kind: "color", value: "#2563EB" }, width: 0 }]);
  });
  it("a percentage length is of the viewBox", () => {
    const l = upgrade({ oim: "1.27.9", canvas: { natural_width: 1000, natural_height: 1000 }, slots: [{ id: "a", type: "geo", position: [0, 0], style: { width: 10, height: 10, svgRawXml: '<svg width="160" height="80"><rect width="100%" height="50%" fill="#000"/></svg>' } }] } as never).document.layers[0] as any;
    expect(l.geometry.paths[0].d).toBe("M0 0H160V40H0Z");
  });
});
