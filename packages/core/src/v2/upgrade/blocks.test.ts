/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Text, geometry, SVG, animations, mask and variables.
import { describe, expect, it } from "vitest";
import { documentSchema } from "../schema.js";
import { upgrade } from "../upgrade.js";
import { svgToPaths } from "./svg-paths.js";

type Extra = { content?: unknown; root?: object; slot?: object };
const doc = (style: object, type = "geo", extra: Extra = {}) => ({
  oim: "1.27.9",
  canvas: { natural_width: 1000, natural_height: 1000 },
  languages: ["es", "en"],
  slots: [{ id: "a", type, position: [0, 0], content: extra.content, style: { width: 10, height: 10, ...style }, ...extra.slot }],
  ...extra.root,
});
const run = (style: object, type?: string, extra?: Extra) => upgrade(doc(style, type, extra));
const layer = (style: object, type?: string, extra?: Extra) => run(style, type, extra).document.layers[0];
const valid = (style: object, type?: string, extra?: Extra) => {
  const parsed = documentSchema.safeParse(run(style, type, extra).document);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("text", () => {
  it("content is always a map by language", () => {
    expect(layer({}, "text", { content: { es: "Hola", en: "Hello" } }).text?.content).toEqual({ es: "Hola", en: "Hello" });
    expect(layer({}, "text", { content: "Hola" }).text?.content).toEqual({ es: "Hola" });
  });

  it("font: family, size in canvas units, weight and italic; the defaults are not written", () => {
    expect(layer({ fontFamily: "Inter", fontSize: "6.4cqw", fontWeight: 700, fontStyle: "italic" }, "text").text?.font).toEqual({
      family: "Inter", size: 64, weight: 700, italic: true,
    });
    expect(layer({ fontFamily: "Inter", fontWeight: 400, fontStyle: "normal" }, "text").text?.font).toEqual({ family: "Inter" });
    expect(layer({ fontWeight: "700" }, "text").text?.font).toEqual({ weight: 700 });
  });

  it("the undeclared bold, italic and underline flags", () => {
    const text = layer({ bold: true, italic: true, underline: true }, "text").text;
    expect(text?.font).toEqual({ weight: 700, italic: true });
    expect(text?.decoration).toBe("underline");
    expect(layer({ bold: false, italic: false, underline: false }, "text").text).toEqual({ content: {} });
  });

  it("alignment comes from textAlign or the layer's align; left is the default", () => {
    expect(layer({ textAlign: "center" }, "text").text?.align).toBe("center");
    expect(layer({}, "text", { slot: { align: "right" } }).text?.align).toBe("right");
    expect(layer({ textAlign: "left" }, "text").text).not.toHaveProperty("align");
  });

  it("spacing, transform, decoration and width: only what differs from the default", () => {
    expect(layer({ lineHeight: 1.3, letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", maxWidth: "50.0cqw" }, "text").text).toEqual({
      content: {}, lineHeight: 1.3, letterSpacing: 2, transform: "uppercase", maxWidth: 500,
    });
  });

  it("a size per language becomes an exception by mode; the main language is the value", () => {
    expect(layer({ fontSize: "6cqw", fontSizes: { en: "5cqw", ja: "6cqw" } }, "text").text?.font?.size).toEqual({ value: 60, modes: { en: 50 } });
    expect(layer({ fontSize: "6cqw", fontSizes: { es: "8cqw" } }, "text").text?.font?.size).toBe(80);
    expect(layer({ maxWidth: "90cqw", maxWidths: { en: "70cqw" } }, "text").text?.maxWidth).toEqual({ value: 900, modes: { en: 700 } });
  });

  it("marks and runs travel as they are", () => {
    const marks = { accent: { color: "#A83214", italic: true } };
    const textRuns = { es: { fontSize: 148, lineHeight: 136.2, lines: [{ text: "HOLA", width: 400, yOffset: 0 }] } };
    const text = layer({ marks, textRuns }, "text").text;
    expect(text?.marks).toEqual(marks);
    expect(text?.runs).toEqual(textRuns);
    expect(valid({ marks, textRuns }, "text")).toEqual([]);
  });

  it("artistic text is a text with an artistic block", () => {
    const text = layer({ artisticPreset: "retro-wave-3d", curveType: "arc", curveAmount: 24, extrusionDepth: 10, extrusionAngle: 135, extrusionColor: "#e76f51", extrusionShading: true }, "artistic-text", { content: { es: "RETRO" } });
    expect(text.type).toBe("text");
    expect(text.text?.artistic).toEqual({ preset: "retro-wave-3d", curve: { type: "arc", amount: 24 }, extrusion: { depth: 10, angle: 135, color: "#e76f51", shading: true } });
    expect(layer({ curveType: "arc", curveAmount: 0 }, "artistic-text").text?.artistic).toEqual({});
  });

  it("typography on a layer that is not a text is noise: dropped, not reported", () => {
    const result = run({ fontFamily: "Inter", fontSize: "1.4815cqw", textAlign: "left", textDecoration: "none", fontStyle: "normal", fontWeight: 400, maxWidth: "93cqw" }, "geo", { slot: { align: "left" } });
    expect(result.document.layers[0]).not.toHaveProperty("text");
    expect(result.unhandled).toEqual([]);
  });
});

describe("svgToPaths", () => {
  const lucide = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide" aria-hidden="true"><path d="M12 3v18"/><circle cx="12" cy="12" r="3"/></svg>';

  it("reads an outline icon: stroke inherited from the root, no fill", () => {
    const result = svgToPaths(lucide);
    expect(result).toEqual({
      ok: true,
      value: {
        viewBox: [0, 0, 24, 24],
        paths: [
          { d: "M12 3v18", stroke: "currentColor", strokeWidth: 1.5, cap: "round", join: "round" },
          { d: "M9 12A3 3 0 1 0 15 12A3 3 0 1 0 9 12Z", stroke: "currentColor", strokeWidth: 1.5, cap: "round", join: "round" },
        ],
      },
    });
  });

  it("a filled path with no fill attribute is black, as SVG says", () => {
    const result = svgToPaths('<svg viewBox="0 0 10 10"><path d="M0 0h10v10z" fill-rule="evenodd"/></svg>');
    expect(result.ok && result.value.paths).toEqual([{ d: "M0 0h10v10z", fill: "black", fillRule: "evenodd" }]);
  });

  it("basic shapes become path data", () => {
    const d = (xml: string) => {
      const result = svgToPaths(`<svg viewBox="0 0 10 10">${xml}</svg>`);
      return result.ok ? result.value.paths.map((p) => p.d) : result.reason;
    };
    expect(d('<rect x="1" y="2" width="4" height="3"/>')).toEqual(["M1 2H5V5H1Z"]);
    expect(d('<rect width="4" height="4" rx="1"/>')).toEqual(["M1 0H3A1 1 0 0 1 4 1V3A1 1 0 0 1 3 4H1A1 1 0 0 1 0 3V1A1 1 0 0 1 1 0Z"]);
    expect(d('<ellipse cx="5" cy="5" rx="2" ry="1"/>')).toEqual(["M3 5A2 1 0 1 0 7 5A2 1 0 1 0 3 5Z"]);
    expect(d('<line x1="0" y1="0" x2="4" y2="4"/>')).toEqual(["M0 0L4 4"]);
    expect(d('<polygon points="0,0 4,0 2,3"/>')).toEqual(["M0 0L4 0L2 3Z"]);
    expect(d('<polyline points="0,0 4,0 2,3"/>')).toEqual(["M0 0L4 0L2 3"]);
  });

  it("a group passes its transform and its paint to its children", () => {
    const result = svgToPaths('<svg viewBox="0 0 10 10"><g transform="translate(2 3)" fill="#f00"><g transform="scale(2)"><path d="M0 0h1"/></g></g><path d="M0 0h2"/></svg>');
    expect(result.ok && result.value.paths).toEqual([
      { d: "M0 0h1", fill: "#f00", transform: [2, 0, 0, 2, 2, 3] },
      { d: "M0 0h2", fill: "black" },
    ]);
  });

  it("the size, when there is no viewBox and it is in units", () => {
    const sized = svgToPaths('<svg width="24" height="12"><path d="M0 0h1"/></svg>');
    expect(sized.ok && sized.value.viewBox).toEqual([0, 0, 24, 12]);
    expect(svgToPaths('<svg width="100%" height="100%"><path d="M0 0h1"/></svg>')).toEqual({ ok: false, reason: "the <svg> declares no viewBox nor a size in units" });
  });

  it("title and desc are skipped; comments too", () => {
    const result = svgToPaths('<?xml version="1.0"?><!-- x --><svg viewBox="0 0 1 1"><title>Sun <b>x</b></title><path d="M0 0h1"/></svg>');
    expect(result.ok && result.value.paths).toHaveLength(1);
  });

  it.each([
    ['<svg viewBox="0 0 1 1"><text>hi</text></svg>', "<text> is outside the static profile"],
    ['<svg viewBox="0 0 1 1"><filter id="f"/></svg>', "<filter> is outside the static profile"],
    ['<svg viewBox="0 0 1 1"><use href="#a"/></svg>', "<use> is outside the static profile"],
    ['<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>', "<script> is outside the static profile"],
    ['<svg viewBox="0 0 1 1"><path d="M0 0" style="fill:red"/></svg>', "<path> carries a style attribute"],
    ['<svg viewBox="0 0 1 1" onload="x()"><path d="M0 0h1"/></svg>', "<svg> carries an event handler (onload)"],
    ['<svg viewBox="0 0 1 1"><path d="M0 0h1" fill="url(#g)"/></svg>', "<path> paints with a reference (fill)"],
    ['<svg viewBox="0 0 1 1"><g transform="warp(3)"><path d="M0 0h1"/></g></svg>', "<g> has a transform that cannot be read"],
    ['<svg viewBox="0 0 1 1"></svg>', "nothing to draw"],
    ["<div/>", "<div> is outside the static profile"],
    ["", "not an SVG string"],
  ])("refuses %s", (xml, reason) => {
    expect(svgToPaths(xml)).toEqual({ ok: false, reason });
  });
});

describe("geometry, corners and images", () => {
  it("the named figures: three have their own kind, the rest are presets", () => {
    expect(layer({ geoShape: "rectangle" }).geometry).toEqual({ kind: "rect" });
    expect(layer({ geoShape: "circle" }).geometry).toEqual({ kind: "ellipse" });
    expect(layer({ geoShape: "line" }).geometry).toEqual({ kind: "line" });
    expect(layer({ geoShape: "star" }).geometry).toEqual({ kind: "preset", name: "star" });
    expect(layer({ geoType: "triangle" }).geometry).toEqual({ kind: "preset", name: "triangle" });
    expect(layer({}).geometry).toEqual({ kind: "rect" });
  });

  it("a custom figure keeps its path and view box", () => {
    expect(layer({ geoShape: "custom", svgPath: "M12 2L22 22H2Z", svgViewBox: "0 0 24 24" }).geometry).toEqual({
      kind: "paths", viewBox: [0, 0, 24, 24], paths: [{ d: "M12 2L22 22H2Z" }],
    });
  });

  it("an SVG layer becomes paths, from svgRawXml or from its content", () => {
    const xml = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 1a2 2 0 0 1 2 2"/></svg>';
    const expected = { kind: "paths", viewBox: [0, 0, 24, 24], paths: [{ d: "M8 1a2 2 0 0 1 2 2", fill: "currentColor" }] };
    expect(layer({ svgRawXml: xml }, "svg").geometry).toEqual(expected);
    expect(layer({}, "svg", { content: { "*": xml } }).geometry).toEqual(expected);
    expect(valid({ svgRawXml: xml }, "svg")).toEqual([]);
  });

  it("the decomposed layers win over the raw XML: they carry the edited colours", () => {
    const svgLayers = [{ d: "M0 0h1", fill: "#ff0000", animationType: "none" }, { d: "M0 0v1", stroke: "#00f", strokeWidth: 2 }];
    expect(layer({ svgLayers, svgRawXml: '<svg viewBox="0 0 9 9"><path d="M9 9"/></svg>', svgViewBox: "0 0 16 16" }, "svg").geometry).toEqual({
      kind: "paths", viewBox: [0, 0, 16, 16], paths: [{ d: "M0 0h1", fill: "#ff0000" }, { d: "M0 0v1", stroke: "#00f", strokeWidth: 2 }],
    });
  });

  it("an SVG outside the profile keeps its layer and says why", () => {
    const result = run({ svgRawXml: '<svg viewBox="0 0 1 1"><text>hi</text></svg>' }, "svg");
    expect(result.document.layers[0].geometry).toEqual({ kind: "rect" });
    expect(result.document.layers[0].box).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(result.unhandled).toEqual(["style.svgRawXml: <text> is outside the static profile"]);
  });

  it("corners: one number in canvas units, four when they differ, none when zero", () => {
    expect(layer({ borderRadius: "2.5cqw" }).corners).toBe(25);
    expect(layer({ borderRadius: "0.0cqw" })).not.toHaveProperty("corners");
    expect(layer({ borderRadius: 10, borderRadiusTL: 0, borderRadiusBR: 30 }).corners).toEqual([0, 10, 30, 10]);
    expect(layer({ borderRadius: 10 }, "text")).not.toHaveProperty("corners");
  });

  it("an image: its source from content, fit and crop; cover is the default", () => {
    const crop = { x: 7.1, y: 0, zoom: 3.8 };
    expect(layer({ objectFit: "contain", imageCrop: crop }, "image", { content: { "*": "data:image/png;base64,AA" } }).image).toEqual({
      src: "data:image/png;base64,AA", fit: "contain", crop,
    });
    expect(layer({ objectFit: "cover" }, "image", { content: { "*": "https://cdn.oim.media/demos/crop.png" } }).image).toEqual({ src: "https://cdn.oim.media/demos/crop.png" });
  });

  it("an image with no source of its own points at the PNG of the file", () => {
    expect(layer({}, "image").image).toEqual({ src: "oim:base" });
    expect(layer({}, "image", { content: { es: "" } }).image).toEqual({ src: "oim:base" });
  });

  it("flip is part of the box, on any layer", () => {
    expect(layer({ flipX: true }, "image").box).toMatchObject({ flipX: true });
    expect(layer({ flipY: true }, "geo").box).toMatchObject({ flipY: true });
    expect(layer({ flipX: false }, "geo").box).not.toHaveProperty("flipX");
  });

  it("alternative text and decorative, where the layer admits them", () => {
    expect(layer({ alt: { es: "Foto", en: "Photo" } }, "image").a11y).toEqual({ alt: { es: "Foto", en: "Photo" } });
    expect(layer({ decorative: true }, "svg").a11y).toEqual({ decorative: true });
    expect(layer({ decorative: true }, "text")).not.toHaveProperty("a11y");
  });

  it("empty content on a shape or a group is nothing; it is not reported", () => {
    expect(run({}, "geo", { content: { es: "" } }).unhandled).toEqual([]);
    expect(run({}, "group", { content: {} }).unhandled).toEqual([]);
  });
});

describe("animations, motion and interactions", () => {
  const frames = [{ t: 0, o: 0, y: 35, s: 1, r: 0, x: 0 }, { t: 0.45, o: 0, y: 35, e: [0.16, 1, 0.3, 1] }, { t: 2, o: 1, y: 0 }];

  it("keyframes: one track per property that leaves its rest value, time from 0 to 1", () => {
    expect(layer({ animation: { duration: 2, keyframes: frames } }).animations).toEqual([
      {
        on: "loop",
        duration: 2000,
        tracks: [
          { property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 0.225, v: 0, e: [0.16, 1, 0.3, 1] }, { t: 1, v: 1 }] },
          { property: "y", keyframes: [{ t: 0, v: 35 }, { t: 0.225, v: 35, e: [0.16, 1, 0.3, 1] }, { t: 1, v: 0 }] },
        ],
      },
    ]);
    expect(valid({ animation: { duration: 2, keyframes: frames } })).toEqual([]);
  });

  it("keyframes that never leave rest animate nothing", () => {
    expect(layer({ animation: { duration: 2, keyframes: [{ t: 0, o: 1, s: 1 }, { t: 2, o: 1, s: 1 }] } })).not.toHaveProperty("animations");
  });

  it("a trigger of action plays once when something starts it; a delay is in milliseconds", () => {
    expect(layer({ animation: { duration: 1, delay: 0.5, trigger: "action", keyframes: [{ t: 0, s: 1 }, { t: 1, s: 2 }] } }).animations?.[0]).toMatchObject({ on: "action", delay: 500 });
  });

  it("the named loop and hover presets", () => {
    expect(layer({ animation: { loop: "pulse", hover: "grow", duration: 3 } }).animations).toEqual([
      { on: "loop", preset: "pulse", duration: 3000 },
      { on: "hover", preset: "grow", duration: 200 },
    ]);
    expect(layer({ animation: { loop: "none", hover: "none" } })).not.toHaveProperty("animations");
  });

  it("raw CSS inside an animation is reported, not carried", () => {
    expect(run({ animation: { custom_loop_css: "x 1s infinite" } }).unhandled).toEqual(["style.animation.custom_loop_css: raw CSS is not carried to 2.0"]);
    expect(run({ cssAnimation: "spin 1s linear infinite" }).unhandled).toEqual(["style.cssAnimation: raw CSS is not carried to 2.0"]);
  });

  it("a text animation is a preset over characters, words or lines", () => {
    expect(layer({ textAnimationType: "fade-chars", textAnimationSpeed: 1.1, textAnimationDelay: 0 }, "text").animations).toEqual([
      { on: "load", target: "chars", preset: "fade-chars", params: { speed: 1.1 }, duration: 0 },
    ]);
    expect(layer({ textAnimationType: "rise-words", textAnimationDelay: 2 }, "text").animations?.[0]).toMatchObject({ target: "words", delay: 2000 });
    expect(layer({ textAnimationType: "typewriter", typewriterCursor: true, textAnimationIntensity: 50 }, "text").animations?.[0].params).toEqual({ intensity: 50, cursor: true });
    expect(layer({ textAnimationType: "none" }, "text")).not.toHaveProperty("animations");
    expect(layer({ textAnimationType: "fade-chars" }, "geo")).not.toHaveProperty("animations");
    expect(valid({ textAnimationType: "fade-chars" }, "text")).toEqual([]);
  });

  it("reveal is an entrance", () => {
    expect(layer({ reveal: { effect: "slide-up", duration: 400, easing: [0.22, 1, 0.36, 1] } }).animations).toEqual([
      { on: "enter", preset: "slide-up", duration: 400, easing: [0.22, 1, 0.36, 1] },
    ]);
  });

  it("the drawing of a stroke is a track over trimEnd", () => {
    expect(layer({ trimStart: 0, trimEnd: 100, trimDuration: 2.2 }).animations).toEqual([
      { on: "load", duration: 2200, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] },
    ]);
  });

  it("a state that changes the look is an animation; the scale was a percentage", () => {
    expect(layer({ states: { hover: { scale: 105, transitionDuration: 200 } } }).animations).toEqual([
      { on: "hover", duration: 200, tracks: [{ property: "scale", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 1.05 }] }] },
    ]);
    expect(layer({ states: { hover: { scale: 1.05 } } }).animations?.[0].tracks?.[0].keyframes[1].v).toBe(1.05);
    expect(layer({ states: { active: { opacity: 50, rotation: 10 } } }).animations?.[0]).toMatchObject({ on: "press", tracks: [{ property: "rotation" }, { property: "opacity", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 0.5 }] }] });
  });

  it("a state that acts on other layers is an interaction, not an animation", () => {
    const result = layer({ isInteractive: true, states: { hover: { actions: [{ target: "g1", type: "toggle" }], transitionDuration: 0 } } });
    expect(result.interactions).toEqual([{ on: "hover", actions: [{ type: "toggle", target: "g1" }] }]);
    expect(result).not.toHaveProperty("animations");
  });

  it("the old toggle of the layer shows and hides on press", () => {
    expect(layer({}, "geo", { slot: { interaction: { action_type: "toggle_elements", target: { show_slots: ["a1"], hide_slots: ["b1", "b2"] } } } }).interactions).toEqual([
      { on: "press", actions: [{ type: "show", target: "a1" }, { type: "hide", target: "b1" }, { type: "hide", target: "b2" }] },
    ]);
  });

  it("parallax and scene loop are motion, wherever 1.x wrote them", () => {
    const parallax = { enabled: true, depth: 0.2, mode: "infinite_horizontal", axis: "x_only" };
    expect(layer({}, "image", { slot: { parallax } }).motion).toEqual({ parallax });
    expect(layer({ parallax }, "image").motion).toEqual({ parallax });
    expect(layer({ parallax: { enabled: false, depth: 1 } }, "image")).not.toHaveProperty("motion");
    expect(layer({ sceneLoop: { direction: "left_to_right", speedPxSec: 3 }, loopDepth: 0.2 }, "group").motion).toEqual({
      sceneLoop: { direction: "left_to_right", speedPxSec: 3, depth: 0.2 },
    });
    expect(valid({ parallax }, "image")).toEqual([]);
  });
});

describe("mask and the merged layer types", () => {
  it("a mask is a shape that takes the role, with its own figure, fill and stroke", () => {
    const mask = layer({ maskMode: "cutout", maskInvert: true, maskFeather: 12, maskCoverage: "canvas", maskShape: "circle", maskBgColor: "#000", maskStrokeColor: "#fff", maskStrokeWidth: 2 }, "mask");
    expect(mask).toMatchObject({
      type: "shape",
      mask: { mode: "cutout", invert: true, feather: 12, scope: "canvas" },
      geometry: { kind: "ellipse" },
      fills: [{ kind: "color", value: "#000" }],
      strokes: [{ paint: { kind: "color", value: "#fff" }, width: 2 }],
    });
    expect(valid({ maskMode: "window", maskShape: "star" }, "mask")).toEqual([]);
  });

  it("the default mask of 1.x is the empty block", () => {
    expect(layer({ maskMode: "window", maskInvert: false }, "mask").mask).toEqual({});
  });

  it("maskCoverage and maskInvert on a layer that is not a mask are noise", () => {
    const result = run({ maskCoverage: "canvas", maskInvert: false });
    expect(result.document.layers[0]).not.toHaveProperty("mask");
    expect(result.unhandled).toEqual([]);
  });

  it("a pattern layer is a shape painted with a pattern", () => {
    expect(layer({ fillType: "pattern", fillPatternType: "clouds", fillPatternColor: "#fff" }, "pattern")).toMatchObject({
      type: "shape", geometry: { kind: "rect" }, fills: [{ kind: "pattern", pattern: { preset: "clouds", colors: ["#fff"] } }],
    });
  });
});

describe("variables", () => {
  const palettes = { day: { accent: "#f59e0b", surface: "#fff" }, night: { accent: "#fbbf24", surface: "#18181b" } };

  it("named palettes become variables with one value per palette", () => {
    expect(run({}, "geo", { root: { palettes, defaultPalette: "night" } }).document.variables).toEqual({
      modes: { palette: ["day", "night"], language: ["es", "en"] },
      defaults: { palette: "night" },
      values: { accent: { day: "#f59e0b", night: "#fbbf24" }, surface: { day: "#fff", night: "#18181b" } },
    });
  });

  it("no palettes, no variables; a default that names no palette is ignored", () => {
    expect(run({}, "geo", { root: { palettes: {} } }).document).not.toHaveProperty("variables");
    expect(run({}, "geo", { root: { palettes, defaultPalette: "ghost" } }).document.variables).not.toHaveProperty("defaults");
  });

  it("a document with palettes and bound colours is valid 2.0", () => {
    expect(valid({ fillColor: "#000", fillColorRole: "accent", strokeColor: "#000", strokeColorRole: "surface", strokeWidth: 1 }, "geo", { root: { palettes } })).toEqual([]);
  });
});
