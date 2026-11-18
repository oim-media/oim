/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLayerGrainFilter, DYNAMIC_COLOR_ROLES, mediaFilterCss } from "@oim-media/core";
import { mount } from "./index.js";
import { sceneColors } from "./scene.js";
import { getMaskSilhouetteCanvasD, getWindowMaskCanvasD } from "./legacy/layerComposition.js";
import { buildArtisticTextModelFromLayer, generateArtisticTextSvgString } from "./blocks/artisticText.js";

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

describe("a filter clips its backdrop to its figure", () => {
  const filterOn = (layer: Partial<Layer>) => mount(document.createElement("div"), doc([shape({ effects: [{ kind: "backdrop", preset: "grayscale" }], ...layer })])).elementOf("a")!;

  it("a star filter is clipped to the star, over its own box", () => {
    expect(filterOn({ geometry: { kind: "preset", name: "star" } }).style.clipPath).toMatch(/^path\("M/);
  });

  it("a rectangle filter is not clipped: its corners are the border radius", () => {
    expect(filterOn({ geometry: { kind: "rect" } }).style.clipPath).toBe("");
  });

  it("an image layer shows its picture, with its filters as the media-filter CSS of core", () => {
    const host = document.createElement("div");
    const photo = { id: "p", type: "image", box: { x: 0, y: 0, width: 100, height: 100 }, image: { src: "data:image/png;base64,AA==", filters: { preset: "noir", blur: 2, brightness: 1.2 } } } as Layer;
    mount(host, doc([photo]));
    const img = host.querySelector<HTMLImageElement>("img[data-oim-fill]")!;
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(img.style.filter).toBe(mediaFilterCss({ filterPreset: "noir", filterBlur: 2, filterBrightness: 120 }));
    expect(img.style.clipPath).toBe("inset(0)");
  });

  it("a grain is core's grain filter, defined once in the scene and applied to the layer", () => {
    const host = document.createElement("div");
    mount(host, doc([shape({ effects: [{ kind: "grain", intensity: 40, blend: "multiply" }] } as Partial<Layer>)]));
    const el = host.querySelector<HTMLElement>('[data-oim-id="a"]')!;
    expect(el.style.filter).toContain("url(#oim-grain-a)");
    const filter = host.querySelector("filter#oim-grain-a")!;
    const expected = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${buildLayerGrainFilter("oim-grain-a", { intensity: 40, blend: "multiply" })}</svg>`, "image/svg+xml").querySelector("filter")!;
    expect(filter.outerHTML).toBe(expected.outerHTML);
  });

  it("a colour baked into an image is the active palette's, as the reader's colour scheme picks it", () => {
    const variables = { defaults: { palette: "dark" }, modes: { palette: ["dark", "light"] }, values: { accent: { dark: "#a3e635", light: "#4d7c0f" } } } as OimDocument["variables"];
    const role = { var: "accent", fallback: "#a3e635" };
    expect(sceneColors(variables, undefined, false).colors.literal(role)).toBe("#4d7c0f");
    expect(sceneColors(variables, undefined, true).colors.literal(role)).toBe("#a3e635");
    expect(sceneColors(variables, "dark", false).colors.literal(role)).toBe("#a3e635");
  });

  it("a text in an embedded font asks for the font's own registered name first, then its family", () => {
    const host = document.createElement("div");
    const fonts = [{ family: "Inter", name: "oim-f8947d8f-Inter", weight: 400, style: "normal", format: "woff", data: "d09GRgABAAAA" }];
    const text = { id: "t", type: "text", box: { x: 0, y: 0, width: 100, height: 20 }, text: { content: { es: "Hola" }, font: { family: "Inter", size: 16 } } } as Layer;
    mount(host, { ...doc([text]), fonts } as OimDocument);
    expect(host.querySelector<HTMLElement>('[data-oim-id="t"]')!.style.fontFamily.replace(/["']/g, "")).toBe("oim-f8947d8f-Inter, Inter, sans-serif");
  });

  it("an artistic text is the SVG the artistic-text painter writes for it", () => {
    const host = document.createElement("div");
    const art = { id: "w", type: "text", box: { x: 0, y: 0, width: 400, height: 200 }, text: { content: { es: "Hola" }, font: { family: "Inter", size: 40 }, artistic: { curve: { type: "arc", amount: 30 } } } } as Layer;
    mount(host, doc([art]));
    const svg = host.querySelector('[data-oim-id="w"] svg')!;
    const markup = generateArtisticTextSvgString(buildArtisticTextModelFromLayer(art as never, "es", (v) => v as string), "w");
    expect(svg.outerHTML).toBe(new DOMParser().parseFromString(markup, "image/svg+xml").documentElement.outerHTML);
    expect(host.querySelector<HTMLElement>('[data-oim-id="w"]')!.childNodes[0].nodeType).not.toBe(Node.TEXT_NODE);
  });

  it("a window mask is a canvas-wide frame in its paint with the core's hole cut out, and its stroke on the outline", () => {
    const host = document.createElement("div");
    const m = shape({ id: "m", box: { x: 200, y: 120, width: 300, height: 200 }, geometry: { kind: "ellipse" }, fills: [{ kind: "color", value: "#111111" }], strokes: [{ paint: { kind: "color", value: "#ffffff" }, width: 6 }], mask: {} } as Partial<Layer>);
    mount(host, doc([m]));
    const slot = { id: "m", type: "mask", style: { maskShape: "circle" }, x: 200, y: 120, width: 300, height: 200 };
    const canvas = { width: 1000, height: 500 };
    const frame = host.querySelector<HTMLElement>('[data-oim-id="m"] > [data-oim-mask-frame]')!;
    const paint = frame.querySelector<HTMLElement>("[data-oim-mask-paint]")!;
    const id = /url\(#(.+)\)/.exec(paint.style.clipPath)![1];
    const hole = frame.querySelector(`clipPath#${id} path`)!;
    expect(hole.getAttribute("d")).toBe(getWindowMaskCanvasD(slot, canvas));
    expect(hole.getAttribute("clip-rule")).toBe("evenodd");
    expect(paint.style.backgroundColor).toBe("#111111");
    const ring = frame.querySelector("svg[data-oim-mask-outline] path")!;
    expect(ring.getAttribute("d")).toBe(getMaskSilhouetteCanvasD(slot, canvas));
    expect(ring.getAttribute("stroke-width")).toBe("6");
    expect(host.querySelector<HTMLElement>('[data-oim-id="m"]')!.style.backgroundColor).toBe("transparent");
  });

  it("a hidden layer takes no room and no pointer until something shows it", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([shape({ visible: false } as Partial<Layer>)]));
    const el = host.querySelector<HTMLElement>('[data-oim-id="a"]')!;
    expect(el.style.display).toBe("none");
    scene.update("a", { visible: true } as Partial<Layer>);
    expect(el.style.display).toBe("");
  });
});

describe("time and interaction", () => {
  const calls: { id: string; frames: Keyframe[]; timing: KeyframeAnimationOptions; run: Record<string, unknown> }[] = [];
  const realAnimate = HTMLElement.prototype.animate;
  const stub = () => {
    HTMLElement.prototype.animate = function (this: HTMLElement, frames: Keyframe[], timing: KeyframeAnimationOptions) {
      const run = { finish: vi.fn(), cancel: vi.fn(), play: vi.fn(), reverse: vi.fn(), onfinish: null as null | (() => void) };
      calls.push({ id: this.dataset.oimId ?? "", frames, timing, run });
      return run as unknown as Animation;
    } as typeof HTMLElement.prototype.animate;
  };
  afterEach(() => { HTMLElement.prototype.animate = realAnimate; calls.length = 0; });

  const reveal = () => doc([
    shape({ id: "panel", visible: false, animations: [{ on: "enter", preset: "slide-up", duration: 400 }] } as Partial<Layer>),
    shape({ id: "icon", animations: [{ on: "action", tracks: [{ property: "scale", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 1.2 }] }], duration: 600 }] } as Partial<Layer>),
    shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "show", target: "panel" }, { type: "play", target: "icon" }] }] } as Partial<Layer>),
  ]);

  it("a press shows the panel with its entrance, then plays the icon, in that order", () => {
    stub();
    const host = document.createElement("div");
    const scene = mount(host, reveal());
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("panel")!.style.display).toBe("");
    expect(calls.map((c) => c.id)).toEqual(["panel", "icon"]);
    expect(calls[0].timing.duration).toBe(400);
    expect(calls[1].frames.at(-1)).toMatchObject({ scale: "1.2" });
  });

  it("a toggle hides what it showed, and the layer leaves the layout once its exit ends", () => {
    stub();
    const host = document.createElement("div");
    const scene = mount(host, doc([
      shape({ id: "card" }),
      shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "toggle", target: "card" }] }] } as Partial<Layer>),
    ]));
    const card = scene.elementOf("card")!;
    scene.elementOf("btn")!.click();
    expect(card.style.display).toBe(""); // still leaving
    (calls[0].run.onfinish as () => void)();
    expect(card.style.display).toBe("none");
    scene.elementOf("btn")!.click();
    expect(card.style.display).toBe("");
  });

  it("paused, an action lands at once and nothing is animated", () => {
    stub();
    const host = document.createElement("div");
    const scene = mount(host, reveal(), { paused: true });
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("panel")!.style.display).toBe("");
    expect(calls).toEqual([]);
  });

  it("paused, a named loop rests at its first frame and a load entrance at its end", () => {
    stub();
    const host = document.createElement("div");
    const scene = mount(host, doc([
      shape({ id: "p", animations: [{ on: "loop", preset: "pulse", duration: 0 }] } as Partial<Layer>),
      shape({ id: "f", animations: [{ on: "load", preset: "fade", duration: 300 }] } as Partial<Layer>),
    ]), { paused: true });
    const [loop, load] = calls;
    expect(loop.timing.iterations).toBe(Infinity);
    expect(loop.run.cancel).toHaveBeenCalled();
    expect(loop.run.finish).not.toHaveBeenCalled();
    expect(load.run.finish).toHaveBeenCalled();
    expect(scene.elementOf("p")).toBeTruthy();
  });

  it("a text entrance flows its units as one paragraph inside the text box", () => {
    stub();
    const host = document.createElement("div");
    const scene = mount(host, doc([
      { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola" } }, animations: [{ on: "load", target: "chars", preset: "fade-chars", duration: 0 }] } as unknown as Layer,
    ]));
    const el = scene.elementOf("t")!;
    expect(el.children).toHaveLength(1);
    const body = el.firstElementChild as HTMLElement;
    expect(body.style.alignSelf).toBe("stretch");
    expect(body.querySelectorAll("span")).toHaveLength(4);
    expect(calls).toHaveLength(4);
  });

  it("play and pause reach every running animation of the scene", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([]));
    const run = { play: vi.fn(), pause: vi.fn() };
    (host.querySelector(".oim-scene") as HTMLElement).getAnimations = () => [run as unknown as Animation];
    scene.pause();
    scene.play();
    expect(run.pause).toHaveBeenCalledTimes(1);
    expect(run.play).toHaveBeenCalledTimes(1);
  });

  it("setText replaces the words in the reader's language", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([
      { id: "label", type: "text", box: { x: 0, y: 0, width: 200, height: 40 }, text: { content: { es: "Hola" }, runs: [] } } as unknown as Layer,
      shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "setText", target: "label", value: "Adiós" }] }] } as Partial<Layer>),
    ]));
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("label")!.textContent).toContain("Adiós");
  });
});

describe("duotone", () => {
  it("a duotone backdrop sees the layers under it through the shared two-tone filter, defined once", () => {
    const host = document.createElement("div");
    const layer = shape({ id: "f", type: "shape", effects: [{ kind: "backdrop", preset: "duotone" }] } as Partial<Layer>);
    const scene = mount(host, doc([layer]));
    scene.update("f", { effects: [{ kind: "backdrop", preset: "duotone" }] } as Partial<Layer>);
    expect(scene.elementOf("f")!.style.backdropFilter).toBe("url(#duotone-filter-f)");
    const filters = host.querySelectorAll("filter#duotone-filter-f");
    expect(filters.length).toBe(1);
    expect(filters[0].querySelector("feFuncR")!.getAttribute("tableValues")).toBe("0.118 0.984");
  });
});

describe("color-grade", () => {
  it("paints the preset's matrix as the last filter, once per layer, and drops it when removed", () => {
    const host = document.createElement("div");
    const grade = { kind: "color-grade", preset: "sepia", intensity: 50 };
    const scene = mount(host, doc([shape({ id: "g", effects: [{ kind: "blur", radius: 2 }, grade] } as Partial<Layer>)]));
    scene.update("g", { effects: [{ kind: "blur", radius: 2 }, grade] } as Partial<Layer>);
    expect(scene.elementOf("g")!.style.filter).toBe("blur(2px) url(#oim-grade-g)");
    const filters = host.querySelectorAll("filter#oim-grade-g");
    expect(filters.length).toBe(1);
    expect(filters[0].getAttribute("color-interpolation-filters")).toBe("sRGB");
    expect(filters[0].querySelector("feColorMatrix")!.getAttribute("values")!.split(" ")[0]).toBe("0.6965");
    scene.update("g", { effects: [{ kind: "color-grade", preset: "nope" }] } as Partial<Layer>);
    expect(scene.elementOf("g")!.style.filter).toBe("");
  });
});

describe("filter effect", () => {
  it("paints the layer's own image filters in the effects' order", () => {
    const host = document.createElement("div");
    const effects = [{ kind: "filter", brightness: 1.2, saturate: 0 }, { kind: "blur", radius: 3 }];
    const scene = mount(host, doc([shape({ id: "p", effects } as Partial<Layer>)]));
    scene.update("p", { effects } as Partial<Layer>);
    expect(scene.elementOf("p")!.style.filter).toBe("brightness(120%) saturate(0%) blur(3px)");
  });
});

describe("texture paint", () => {
  it("the canvas texture paints on its own node, in lengths of the canvas width", () => {
    const host = document.createElement("div");
    const d = { ...doc([]), canvas: { width: 1000, height: 500, fills: [{ kind: "color", value: "#101010" }, { kind: "texture", texture: { type: "dots", size: 20, thickness: 2, color: "#ffffff" }, opacity: 0.5 }] } } as OimDocument;
    mount(host, d);
    const canvas = host.querySelector<HTMLElement>(".oim-scene > .oim-canvas")!;
    expect(canvas.style.backgroundColor).toBe("#101010");
    expect(canvas.style.backgroundImage).toBe("radial-gradient(circle, rgba(255, 255, 255, 0.5) 0.2cqw, transparent 0.2cqw)");
    expect(canvas.style.backgroundSize).toBe("2cqw 2cqw");
  });
});

describe("cutout mask", () => {
  it("clips the layers before it, in canvas units, and leaves the ones after it alone", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([
      shape({ id: "cover" }),
      shape({ id: "cut", geometry: { kind: "preset", name: "star" }, mask: { mode: "cutout" }, box: { x: 250, y: 150, width: 300, height: 300 } } as Partial<Layer>),
      shape({ id: "after" }),
    ]));
    const wrapper = host.querySelector<HTMLElement>('[data-oim-cutout="cut"]')!;
    expect(wrapper.contains(scene.elementOf("cover"))).toBe(true);
    expect(wrapper.contains(scene.elementOf("after"))).toBe(false);
    expect(wrapper.style.clipPath).toMatch(/^url\(#/);
    expect(scene.elementOf("cut")).toBeNull();
    const d = host.querySelector(`${wrapper.style.clipPath.slice(4, -1).replace(/"/g, "")} path`)!.getAttribute("d")!;
    expect(d.startsWith("M0 0H1000V500H0Z M250 150H550V450H250Z")).toBe(true); // the canvas, the box, then the figure
  });
});

