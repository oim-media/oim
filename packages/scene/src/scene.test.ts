/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { mount } from "./index.js";

const shape = (o: Partial<Layer> = {}): Layer => ({
  id: "a",
  type: "shape",
  box: { x: 100, y: 100, width: 500, height: 100 },
  geometry: { kind: "rect" },
  ...o,
} as Layer);

const doc = (layers: Layer[]): OimDocument =>
  ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers }) as OimDocument;

describe("mount", () => {
  it("the root keeps the canvas ratio and is a size container", () => {
    const host = document.createElement("div");
    mount(host, doc([]));
    const root = host.firstElementChild as HTMLElement;
    expect(root.style.aspectRatio.replace(/\s/g, "")).toBe("1000/500");
    expect(root.style.containerType).toBe("inline-size");
  });

  it("a layer sits at its box, as shares of the canvas", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape()]));
    const el = scene.elementOf("a")!;
    expect(el.dataset.oimId).toBe("a");
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(["10%", "20%", "50%", "20%"]);
  });

  it("a child is placed inside its group, from canvas units", () => {
    const group = {
      id: "g", type: "group", box: { x: 100, y: 100, width: 400, height: 200 },
      children: [shape({ id: "c", box: { x: 200, y: 150, width: 100, height: 50 } })],
    } as Layer;
    const scene = mount(document.createElement("div"), doc([group]));
    const el = scene.elementOf("c")!;
    expect(el.parentElement).toBe(scene.elementOf("g"));
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(["25%", "25%", "25%", "25%"]);
  });

  it("rotation and flips go into the transform", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape({ box: { x: 0, y: 0, width: 10, height: 10, rotation: -2, flipX: true, flipY: true } })]));
    expect(scene.elementOf("a")!.style.transform).toBe("rotate(-2deg) scaleX(-1) scaleY(-1)");
  });

  it("a box with no rotation or flip has no transform", () => {
    const host = document.createElement("div");
    expect(mount(host, doc([shape()])).elementOf("a")!.style.transform).toBe("");
  });

  it("a text with no size fits its content and is placed by its anchor", () => {
    const text = { id: "t", type: "text", box: { x: 500, y: 250, anchor: "center" }, text: { content: { es: "Hola" } } } as Layer;
    const el = mount(document.createElement("div"), doc([text])).elementOf("t")!;
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(["50%", "50%", "", ""]);
    expect(el.style.transform).toBe("translate(-50%, -50%)");
  });

  it.each([
    ["top-left", ""],
    ["right", "translate(-100%, -50%)"],
    ["bottom", "translate(-50%, -100%)"],
  ])("anchor %s moves the box by %s", (anchor, transform) => {
    const box = { x: 0, y: 0, width: 10, height: 10, anchor } as Layer["box"];
    expect(mount(document.createElement("div"), doc([shape({ box })])).elementOf("a")!.style.transform).toBe(transform);
  });

  it("elementOf an unknown id is null", () => {
    expect(mount(document.createElement("div"), doc([shape()])).elementOf("nope")).toBeNull();
  });

  it("destroy empties the container and forgets the layers", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape()]));
    scene.destroy();
    expect(host.childElementCount).toBe(0);
    expect(scene.elementOf("a")).toBeNull();
  });
});
