/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { unsupportedUse } from "./coverage.js";

const doc = (layers: Layer[], extra: Partial<OimDocument> = {}): OimDocument =>
  ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers, ...extra }) as OimDocument;

const rect = (o: Partial<Layer> = {}): Layer =>
  ({ id: "a", type: "shape", box: { x: 0, y: 0, width: 10, height: 10 }, geometry: { kind: "rect" }, fills: [{ kind: "color", value: "#fff" }], ...o }) as Layer;

describe("unsupportedUse", () => {
  it("a document of in-scope blocks uses nothing out of scope", () => {
    const text = { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola" }, font: { size: 12 } } } as Layer;
    expect(unsupportedUse(doc([rect(), text]))).toEqual([]);
  });

  it("reports each out-of-scope block once, sorted", () => {
    const layers = [
      rect({ effects: [{ kind: "grain", intensity: 20 }] }),
      rect({ id: "b", animations: [{ on: "load", target: "chars", preset: "typewriter", duration: 0 }] }),
      rect({ id: "d", animations: [{ on: "load", preset: "fade", duration: 1 }] }),
      rect({ id: "c", fills: [{ kind: "pattern", pattern: { preset: "dots" } }] as Layer["fills"] }),
      { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "x" }, runs: [] } } as unknown as Layer,
    ];
    expect(unsupportedUse(doc(layers))).toEqual(["animation:preset"]);
  });

  it("the effects scene paints (blur, shadow, glow, backdrop) are not out of scope", () => {
    const effects = [{ kind: "blur", radius: 2 }, { kind: "shadow", blur: 4 }, { kind: "glow", radius: 6 }, { kind: "backdrop", blur: 8 }] as Layer["effects"];
    expect(unsupportedUse(doc([rect({ effects })]))).toEqual([]);
  });

  it("every effect is painted: an image filter, a colour grade, a texture and a duotone backdrop", () => {
    const effects = [{ kind: "backdrop", preset: "duotone" }, { kind: "texture", preset: "paper" }, { kind: "color-grade", preset: "warm" }, { kind: "filter", blur: 1 }] as Layer["effects"];
    expect(unsupportedUse(doc([rect({ effects })]))).toEqual([]);
  });

  it("a layer's opacity and blend mode are painted; a picture on a figure is not yet", () => {
    expect(unsupportedUse(doc([rect({ opacity: 0.7, blend: "multiply" })]))).toEqual([]);
    const figure = rect({ geometry: { kind: "preset", name: "star" }, fills: [{ kind: "image", src: "data:image/png;base64,AA==" }] } as Partial<Layer>);
    expect(unsupportedUse(doc([figure]))).toEqual([]);
  });

  it("a pattern whose tile is a drawing is painted; paths with a pattern (a draft background or an icon) wait", () => {
    const tile = rect({ fills: [{ kind: "pattern", pattern: { tile: { viewBox: [0, 0, 20, 20], paths: [{ d: "M0 0H10V10H0Z" }] } } }] } as Partial<Layer>);
    expect(unsupportedUse(doc([tile]))).toEqual([]);
    const icon = rect({ geometry: { kind: "paths", viewBox: [0, 0, 20, 20], paths: [{ d: "M0 0H160V160H0Z" }] }, fills: [{ kind: "pattern", pattern: { preset: "stars" } }] } as Partial<Layer>);
    expect(unsupportedUse(doc([icon]))).toEqual(["paint:pattern-tile"]);
    expect(unsupportedUse(doc([rect({ fills: [{ kind: "pattern", pattern: { preset: "stars" } }] } as Partial<Layer>)]))).toEqual([]);
  });

  it("looks inside groups; every paint, the canvas texture too, is painted", () => {
    const group = { id: "g", type: "group", box: { x: 0, y: 0, width: 5, height: 5 }, children: [rect({ id: "m", mask: { mode: "cutout" } })] } as Layer;
    expect(unsupportedUse(doc([group]))).toEqual(["mask"]);
    // At the top level a cutout is painted: it clips the layers before it.
    expect(unsupportedUse(doc([rect({ id: "m", mask: { mode: "cutout" } })]))).toEqual([]);
    expect(unsupportedUse(doc([], { canvas: { width: 1, height: 1, fills: [{ kind: "texture", texture: { type: "lines" } }] } as OimDocument["canvas"] }))).toEqual([]);
  });
});
