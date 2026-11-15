/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { mount } from "./index.js";

const doc = (layers: Layer[]): OimDocument => ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers }) as OimDocument;
const base = { id: "base", type: "image", box: { x: 0, y: 0, width: 1000, height: 500 }, image: { src: "oim:base" } } as Layer;
const box = (id: string, x: number) => ({ id, type: "shape", box: { x, y: 0, width: 100, height: 100 }, geometry: { kind: "rect" }, fills: [{ kind: "color", value: "#fff" }] }) as Layer;

describe("the layer tree", () => {
  it("a base picture layer is not painted, and the layers after it keep their place in the stack", () => {
    const scene = mount(document.createElement("div"), doc([box("a", 0), base, box("b", 200)]));
    expect(scene.elementOf("base")).toBeNull();
    expect(scene.elementOf("a")!.nextElementSibling).toBe(scene.elementOf("b"));
  });

  it("a text with no width inside a rotated group is sized by its content and only turned by the group", () => {
    const text = { id: "t", type: "text", box: { x: 100, y: 100 }, text: { content: { es: "Hola" } } } as Layer;
    const group = { id: "g", type: "group", box: { x: 0, y: 0, width: 500, height: 500, rotation: 30 }, children: [text] } as Layer;
    const scene = mount(document.createElement("div"), doc([group]));
    const el = scene.elementOf("t")!;
    expect(el.style.width).toBe("");
    expect(el.style.transform).toBe("");
    expect(scene.elementOf("g")!.style.transform).toBe("rotate(30deg)");
  });

  it("children are stacked in the order of the array", () => {
    const group = { id: "g", type: "group", box: { x: 0, y: 0, width: 1000, height: 500 }, children: [box("c1", 0), box("c2", 0)] } as Layer;
    const scene = mount(document.createElement("div"), doc([group]));
    expect(scene.elementOf("c1")!.nextElementSibling).toBe(scene.elementOf("c2"));
  });
});
