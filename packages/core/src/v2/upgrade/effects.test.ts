/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { documentSchema } from "../schema.js";
import { upgrade } from "../upgrade.js";

const doc = (style: object, type = "geo", root: object = {}) => ({
  oim: "1.27.9",
  canvas: { natural_width: 1000, natural_height: 1000 },
  slots: [{ id: "a", type, position: [0, 0], style: { width: 10, height: 10, ...style } }],
  ...root,
});
const layer = (style: object, type?: string, root?: object) => upgrade(doc(style, type, root)).document.layers[0];
const off = { shadowEnabled: false, shadowColor: "#000000", shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 4, shadowOpacity: 30 };

describe("effects", () => {
  it("a shadow that is switched off is not written, and its six fields are not reported", () => {
    const result = upgrade(doc(off));
    expect(result.document.layers[0]).not.toHaveProperty("effects");
    expect(result.unhandled).toEqual([]);
  });

  it("a shadow that is on, with opacity from 0 to 1", () => {
    expect(layer({ ...off, shadowEnabled: true, shadowOffsetX: 6 }).effects).toEqual([
      { kind: "shadow", x: 6, y: 4, blur: 8, color: "#000000", opacity: 0.3 },
    ]);
  });

  it("a full-opacity shadow with no blur or offset writes only what it has", () => {
    expect(layer({ shadowEnabled: true, shadowColor: "#f59e0b", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 100 }).effects).toEqual([
      { kind: "shadow", color: "#f59e0b" },
    ]);
  });

  it("the shadow colour binds to its role when a palette defines it", () => {
    const palettes = { palettes: { day: { accent: "#f00" } } };
    expect(layer({ ...off, shadowEnabled: true, shadowColorRole: "accent" }, "geo", palettes).effects?.[0]).toMatchObject({ color: { var: "accent" } });
  });

  it("the effects list: each 1.x effect becomes its 2.0 one, and a disabled one is dropped", () => {
    const effects = [
      { type: "drop-shadow", x: 6, y: 6, blur: 0, spread: 0, color: "#1F1714", enabled: true },
      { type: "glow", radius: 24, color: "#f59e0b", intensity: 50 },
      { type: "blur", radius: 5 },
      { type: "color-grade", preset: "cyberpunk", intensity: 40 },
      { type: "texture", preset: "paper", intensity: 30, blend: "overlay", scale: 1 },
      { type: "blur", radius: 9, enabled: false },
    ];
    expect(layer({ effects }).effects).toEqual([
      { kind: "shadow", color: "#1F1714", x: 6, y: 6, blur: 0, spread: 0 },
      { kind: "glow", radius: 24, color: "#f59e0b", intensity: 50 },
      { kind: "blur", radius: 5 },
      { kind: "color-grade", preset: "cyberpunk", intensity: 40 },
      { kind: "texture", preset: "paper", intensity: 30, blend: "overlay" },
    ]);
  });

  // Ruling (13 Nov): the 1.x player filled in a listed effect's missing values,
  // and with a list it painted the list alone.
  it("a listed effect gets the defaults 1.x painted, and the list replaces the loose effects", () => {
    expect(layer({ effects: [{ type: "drop-shadow" }, { type: "glow", radius: 0 }] }).effects).toEqual([
      { kind: "shadow", y: 4, blur: 12, color: "rgba(0, 0, 0, 0.35)" },
      { kind: "glow", radius: 16, color: "#f59e0b" },
    ]);
    expect(layer({ effects: [{ type: "blur", radius: 2 }], layerBlur: 9, grain: true, ...off, shadowEnabled: true }).effects).toEqual([{ kind: "blur", radius: 2 }]);
    expect(layer({ effects: [{ type: "glow" }, { type: "drop-shadow" }, { type: "blur", radius: 2 }] }, "artistic-text").effects).toEqual([{ kind: "blur", radius: 2 }]);
  });

  it("without a list: blur, then grain, then the shadow", () => {
    expect(layer({ ...off, shadowEnabled: true, grain: true, blur: 3 }).effects?.map((fx: { kind: string }) => fx.kind)).toEqual(["blur", "grain", "shadow"]);
  });

  it("an effect type nobody knows is reported", () => {
    expect(upgrade(doc({ effects: [{ type: "warp" }] })).unhandled).toEqual(['style.effects: unknown effect type "warp"']);
  });

  // Ruling (13 Nov): what the 1.x player painted wins. It drew the neon (amber
  // by default) and never drew the named "shadow".
  it("the named effect: neon is a glow, shadow and none are nothing", () => {
    expect(layer({ effect: "neon", effectColor: "#00ff88", effectRadius: 20 }).effects).toEqual([{ kind: "glow", radius: 20, color: "#00ff88" }]);
    expect(layer({ effect: "neon" }).effects).toEqual([{ kind: "glow", radius: 16, color: "#f59e0b" }]);
    expect(layer({ effect: "shadow", effectRadius: 12 })).not.toHaveProperty("effects");
    expect(layer({ effect: "none", effectColor: "#00ff88" })).not.toHaveProperty("effects");
  });

  it("layer blur, only when it blurs", () => {
    expect(layer({ layerBlur: 90 }).effects).toEqual([{ kind: "blur", radius: 90 }]);
    expect(layer({ layerBlur: 0 })).not.toHaveProperty("effects");
  });

  it("a filter layer is a shape with a backdrop effect, percentages as factors", () => {
    const filter = layer({ filterBlur: 10, filterBrightness: 90, filterContrast: 110, filterSaturate: 100, filterHueRotate: 30, filterPreset: "none" }, "filter");
    expect(filter.type).toBe("shape");
    expect(filter.effects).toEqual([{ kind: "backdrop", blur: 10, brightness: 0.9, contrast: 1.1, hueRotate: 30 }]);
  });

  it("the same filters on a shape filled with an image belong to the image", () => {
    const filled = layer({ fillType: "image", fillImage: "data:image/png;base64,AA", filterPreset: "grayscale", filterBrightness: 100 });
    expect(filled.fills).toEqual([{ kind: "image", src: "data:image/png;base64,AA", filters: { preset: "grayscale" } }]);
    expect(filled).not.toHaveProperty("effects");
  });

  it("filters that change nothing are dropped; on a layer with no image they filter the layer itself", () => {
    expect(layer({ filterPreset: "none", filterBrightness: 100 })).not.toHaveProperty("effects");
    expect(layer({ filterBlur: 3, filterSaturate: 140 }).effects).toEqual([{ kind: "filter", blur: 3, saturate: 1.4 }]);
  });

  it("an image layer keeps its filters in the image", () => {
    const image = layer({ filterPreset: "grayscale" }, "image");
    expect(image.image).toEqual({ src: "oim:base", filters: { preset: "grayscale" } });
    expect(image).not.toHaveProperty("effects");
  });

  it("grain per layer", () => {
    expect(layer({ grain: true, grainIntensity: 20, grainSize: 70, grainBlend: "soft-light" }).effects).toEqual([
      { kind: "grain", intensity: 20, size: 70, blend: "soft-light" },
    ]);
    expect(layer({ grain: false, grainIntensity: 20 })).not.toHaveProperty("effects");
  });

  it("grain and effects of the whole canvas become one last layer that covers it", () => {
    const result = upgrade(doc({}, "geo", { grain: { enabled: true, intensity: 40, baseFrequency: 0.8, blendMode: "overlay" }, effects: [{ type: "blur", radius: 2 }] }));
    expect(result.document.layers.at(-1)).toEqual({
      id: "__canvas-effects",
      type: "shape",
      box: { x: 0, y: 0, width: 1000, height: 1000 },
      geometry: { kind: "rect" },
      effects: [{ kind: "blur", radius: 2 }, { kind: "grain", intensity: 40, size: 0.8, blend: "overlay" }],
    });
    expect(result.unhandled).toEqual([]);
    expect(documentSchema.safeParse(result.document).success).toBe(true);
  });

  it("a canvas with its grain switched off gets no extra layer", () => {
    expect(upgrade(doc({}, "geo", { grain: { enabled: false, intensity: 40 } })).document.layers).toHaveLength(1);
  });
});
