/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { mount } from "./index.js";

const shape = (o: Partial<Layer>): Layer => ({ type: "shape", box: { x: 0, y: 0, width: 100, height: 100 }, geometry: { kind: "rect" }, ...o } as Layer);
const doc = (layers: Layer[]): OimDocument => ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers }) as OimDocument;

describe("what a file cannot do through the scene", () => {
  it("a colour cannot inject CSS declarations: it is written as one property, never as style text", () => {
    const hostile = "red; background-image: url(https://third.example/beacon)";
    const scene = mount(document.createElement("div"), doc([
      shape({ id: "a", fills: [{ kind: "color", value: hostile }], strokes: [{ paint: { kind: "color", value: hostile }, width: 2 }] } as Partial<Layer>),
    ]));
    expect(scene.elementOf("a")!.getAttribute("style") ?? "").not.toContain("third.example");
  });
});

describe("a group under an action", () => {
  const file = () => doc([
    shape({ id: "g", type: "group", box: { x: 0, y: 0, width: 1000, height: 500 }, children: [shape({ id: "c" })] } as Partial<Layer>),
    shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "toggle", target: "g" }] }] } as Partial<Layer>),
  ]);

  it("hiding the group hides everything inside it, and showing it brings it all back", () => {
    const scene = mount(document.createElement("div"), file(), { paused: true });
    const child = scene.elementOf("c")!;
    expect(scene.elementOf("g")!.contains(child)).toBe(true);
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("g")!.style.display).toBe("none");
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("g")!.style.display).toBe("");
    expect(scene.elementOf("g")!.contains(child)).toBe(true);
  });
});
