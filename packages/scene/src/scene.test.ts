/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { DYNAMIC_COLOR_ROLES } from "@oim-media/core";
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
    const root = host.querySelector<HTMLElement>(".oim-scene")!;
    expect(root.style.aspectRatio.replace(/\s/g, "")).toBe("1000/500");
    expect(root.style.containerType).toBe("inline-size");
  });

  it("the canvas is centred in its container, as the player letterboxes it", () => {
    const host = document.createElement("div");
    mount(host, doc([]));
    const letterbox = host.firstElementChild as HTMLElement;
    expect(letterbox.style.display).toBe("flex");
    expect(letterbox.style.justifyContent).toBe("center");
    expect(letterbox.querySelector(".oim-scene")).not.toBeNull();
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

  it("setTransform moves one layer to its new box and leaves the others alone", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape(), shape({ id: "b", box: { x: 0, y: 0, width: 100, height: 100 } })]));
    const otherLeft = scene.elementOf("b")!.style.left;
    scene.setTransform("a", { x: 500, y: 250, width: 100, height: 50 });
    const el = scene.elementOf("a")!;
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(["50%", "50%", "10%", "10%"]);
    expect(scene.elementOf("b")!.style.left).toBe(otherLeft);
  });

  it("setTransform places a child inside its group's frame", () => {
    const group = {
      id: "g", type: "group", box: { x: 100, y: 100, width: 400, height: 200 },
      children: [shape({ id: "c", box: { x: 200, y: 150, width: 100, height: 50 } })],
    } as Layer;
    const scene = mount(document.createElement("div"), doc([group]));
    scene.setTransform("c", { x: 200, y: 150, width: 200, height: 100 });
    const el = scene.elementOf("c")!;
    expect([el.style.left, el.style.top, el.style.width, el.style.height]).toEqual(["25%", "25%", "50%", "50%"]);
  });

  it("elementOf an unknown id is null", () => {
    expect(mount(document.createElement("div"), doc([shape()])).elementOf("nope")).toBeNull();
  });

  it("the active palette's colours are custom properties of the root, which a palette binding reads", () => {
    const role = DYNAMIC_COLOR_ROLES[0];
    const withPalettes = { oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es"], layers: [],
      variables: { modes: { palette: ["light", "dark"] }, defaults: { palette: "light" }, values: { [role]: { light: "#123456", dark: "#abcdef" } } } };
    const host = document.createElement("div");
    mount(host, withPalettes as unknown as OimDocument, { palette: "dark" });
    expect(host.querySelector<HTMLElement>(".oim-scene")!.style.getPropertyValue(`--oim-palette-${role}`)).toBe("#abcdef");
  });

  it("a text is written in the reader's language when the file has it, else in the file's first", () => {
    const text = { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola", en: "Hello" } } } as Layer;
    const file = { oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es", "en"], layers: [text] } as unknown as OimDocument;
    const read = (options: Parameters<typeof mount>[2]) => mount(document.createElement("div"), file, options).elementOf("t")!.textContent;
    expect(read({ language: "es" })).toBe("Hola");
    expect(read({})).toBe("Hello");
    expect(read({ language: "fr" })).toBe("Hola");
  });

  it("destroy empties the container and forgets the layers", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape()]));
    scene.destroy();
    expect(host.childElementCount).toBe(0);
    expect(scene.elementOf("a")).toBeNull();
  });
});

describe("layer effects", () => {
  const onShape = (effects: NonNullable<Layer["effects"]>, extra: Partial<Layer> = {}) =>
    mount(document.createElement("div"), doc([shape({ effects, ...extra })])).elementOf("a")!;
  const onText = (effects: NonNullable<Layer["effects"]>) =>
    mount(document.createElement("div"), doc([{ id: "t", type: "text", box: { x: 0, y: 0, width: 400, height: 100 }, text: { content: { es: "Hola" } }, effects } as Layer])).elementOf("t")!;

  it("a blur is the element's CSS filter, at its radius", () => {
    expect(onShape([{ kind: "blur", radius: 4 }]).style.filter).toBe("blur(4px)");
  });

  it("a shadow on a shape follows its silhouette: a drop-shadow, with the opacity in the colour", () => {
    const el = onShape([{ kind: "shadow", x: 10, y: 20, blur: 5, color: "#000000", opacity: 0.5 }]);
    expect(el.style.filter).toBe("drop-shadow(10px 20px 5px rgba(0, 0, 0, 0.5))");
    expect(el.style.textShadow).toBe("");
  });

  it("a shadow on a text follows its glyphs: a text-shadow, not a filter", () => {
    const el = onText([{ kind: "shadow", x: 2, y: 3, blur: 4, color: "#000000", opacity: 0.25 }]);
    expect(el.style.textShadow).toBe("2px 3px 4px rgba(0, 0, 0, 0.25)");
    expect(el.style.filter).toBe("");
  });

  it("a glow on a text is two text-shadows at 0.4 and 1 of its radius", () => {
    expect(onText([{ kind: "glow", radius: 10, color: "#f00" }]).style.textShadow).toBe("0px 0px 4px #f00, 0px 0px 10px #f00");
  });

  it("a glow on a shape is two drop-shadows at 0.4 and 1 of its radius", () => {
    expect(onShape([{ kind: "glow", radius: 10, color: "#f00" }]).style.filter).toBe("drop-shadow(0px 0px 4px #f00) drop-shadow(0px 0px 10px #f00)");
  });

  it("a backdrop blur filters what is behind the layer: the backdrop-filter", () => {
    const el = onShape([{ kind: "backdrop", blur: 8 }]);
    expect(el.style.backdropFilter).toBe("blur(8px)");
    expect(el.style.filter).toBe("");
  });

  it("effects keep their order in the filter", () => {
    expect(onShape([{ kind: "blur", radius: 2 }, { kind: "shadow", y: 4, blur: 6, color: "#000000" }]).style.filter)
      .toBe("blur(2px) drop-shadow(0px 4px 6px #000000)");
  });

  it("an update without effects clears the filter the earlier effects set", () => {
    const scene = mount(document.createElement("div"), doc([shape({ effects: [{ kind: "blur", radius: 4 }] })]));
    expect(scene.elementOf("a")!.style.filter).toBe("blur(4px)");
    scene.update("a", { effects: [] });
    expect(scene.elementOf("a")!.style.filter).toBe("");
  });
});
