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
      rect({ effects: [{ kind: "blur", radius: 2 }] }),
      rect({ id: "b", animations: [{ on: "load", preset: "fade", duration: 1 }] }),
      rect({ id: "c", fills: [{ kind: "pattern", pattern: { preset: "dots" } }] as Layer["fills"] }),
      { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "x" }, runs: [] } } as unknown as Layer,
    ];
    expect(unsupportedUse(doc(layers))).toEqual(["animations", "effects", "paint:pattern", "text:runs"]);
  });

  it("looks inside groups, and into the canvas background", () => {
    const group = { id: "g", type: "group", box: { x: 0, y: 0, width: 5, height: 5 }, children: [rect({ id: "m", mask: { mode: "cutout" } })] } as Layer;
    expect(unsupportedUse(doc([group]))).toEqual(["mask"]);
    expect(unsupportedUse(doc([], { canvas: { width: 1, height: 1, fills: [{ kind: "texture", texture: { type: "lines" } }] } as OimDocument["canvas"] }))).toEqual(["paint:texture"]);
  });
});
