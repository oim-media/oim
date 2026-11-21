/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// What the 2.0 schema admits and the painter now draws (CANONICAL_SPEC_2.md, Appendix D):
// a layer's own languages, a press animation, a text stagger, a trim, a cutout inside a group.
import type { Layer, OimDocument } from "@oim-media/core/v2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "./index.js";

const shape = (o: Partial<Layer> = {}): Layer =>
  ({ id: "a", type: "shape", box: { x: 100, y: 100, width: 500, height: 100 }, geometry: { kind: "rect" }, ...o }) as Layer;
const doc = (layers: Layer[], languages = ["es", "en"]): OimDocument =>
  ({ oim: "2.0.0", canvas: { width: 1000, height: 500 }, languages, layers }) as OimDocument;

type Call = { tag: string; id: string; frames: Keyframe[]; timing: KeyframeAnimationOptions; run: { reverse: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> } };
const calls: Call[] = [];
const realAnimate = Element.prototype.animate;
const stub = () => {
  Element.prototype.animate = function (this: Element, frames: Keyframe[], timing: KeyframeAnimationOptions) {
    const run = { finish: vi.fn(), cancel: vi.fn(), play: vi.fn(), pause: vi.fn(), reverse: vi.fn(), finished: Promise.resolve() };
    calls.push({ tag: this.tagName.toLowerCase(), id: (this as HTMLElement).dataset?.oimId ?? "", frames, timing, run });
    return run as unknown as Animation;
  } as typeof Element.prototype.animate;
};
afterEach(() => { Element.prototype.animate = realAnimate; calls.length = 0; });

describe("a layer's own languages", () => {
  const layers = () => [shape({ id: "all" }), shape({ id: "en-only", languages: ["en"] }), shape({ id: "both", languages: ["es", "en"] })];

  it("hides a layer whose list lacks the document language, and shows the ones that have it", () => {
    const scene = mount(document.createElement("div"), doc(layers()), { language: "es" });
    expect(scene.elementOf("en-only")!.hasAttribute("data-oim-hidden")).toBe(true);
    expect(scene.elementOf("en-only")!.style.display).toBe("none");
    expect(scene.elementOf("all")!.hasAttribute("data-oim-hidden")).toBe(false);
    expect(scene.elementOf("both")!.hasAttribute("data-oim-hidden")).toBe(false);
  });

  it("follows the language when it changes, in both directions", () => {
    const scene = mount(document.createElement("div"), doc(layers()), { language: "es" });
    scene.setMode({ language: "en" });
    expect(scene.elementOf("en-only")!.style.display).toBe("");
    expect(scene.elementOf("en-only")!.hasAttribute("data-oim-hidden")).toBe(false);
    scene.setMode({ language: "es" });
    expect(scene.elementOf("en-only")!.style.display).toBe("none");
  });

  it("matches the way the document language is chosen: exactly, then by primary subtag, in both directions", () => {
    const l = [shape({ id: "en", languages: ["en"] }), shape({ id: "gb", languages: ["en-GB"] }), shape({ id: "es", languages: ["es"] })];
    const regional = mount(document.createElement("div"), doc(l, ["en-US", "es"]), { language: "en-US" });
    expect(regional.elementOf("en")!.hasAttribute("data-oim-hidden")).toBe(false); // en-US ~ en
    expect(regional.elementOf("gb")!.hasAttribute("data-oim-hidden")).toBe(false); // en-US ~ en-GB, same primary
    expect(regional.elementOf("es")!.hasAttribute("data-oim-hidden")).toBe(true);
    const plain = mount(document.createElement("div"), doc(l, ["en", "es"]), { language: "en" });
    expect(plain.elementOf("gb")!.hasAttribute("data-oim-hidden")).toBe(false); // en ~ en-GB
    expect(plain.elementOf("es")!.hasAttribute("data-oim-hidden")).toBe(true);
  });

  it("an action cannot show a layer out of its language", () => {
    const scene = mount(document.createElement("div"), doc([
      shape({ id: "tip", visible: false, languages: ["en"] }),
      shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "show", target: "tip" }] }] } as Partial<Layer>),
    ]), { language: "es" });
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("tip")!.style.display).toBe("none");
  });
});

describe("an animation on press", () => {
  const press = () => doc([shape({ id: "btn", animations: [{ on: "press", tracks: [{ property: "scale", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 0.9 }] }], duration: 300 }] } as Partial<Layer>)]);

  it("runs once on every pointerdown, and nothing at load", () => {
    stub();
    const scene = mount(document.createElement("div"), press());
    expect(calls).toHaveLength(0);
    scene.elementOf("btn")!.dispatchEvent(new Event("pointerdown"));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: "btn", timing: { duration: 300, fill: "none", iterations: 1 } });
    scene.elementOf("btn")!.dispatchEvent(new Event("pointerdown"));
    expect(calls).toHaveLength(2);
  });

  it("a new press cancels the run of the previous one", () => {
    stub();
    const scene = mount(document.createElement("div"), press());
    scene.elementOf("btn")!.dispatchEvent(new Event("pointerdown"));
    expect(calls[0].run.cancel).not.toHaveBeenCalled();
    scene.elementOf("btn")!.dispatchEvent(new Event("pointerdown"));
    expect(calls[0].run.cancel).toHaveBeenCalledTimes(1);
    expect(calls[1].run.cancel).not.toHaveBeenCalled();
  });

  it("paused, a press animates nothing", () => {
    stub();
    const scene = mount(document.createElement("div"), press(), { paused: true });
    scene.elementOf("btn")!.dispatchEvent(new Event("pointerdown"));
    expect(calls).toHaveLength(0);
  });
});

describe("animation.stagger", () => {
  const text = (animation: object, words = "abc") => doc([{ id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: words } }, animations: [animation] } as Layer]);
  const delays = () => calls.map((c) => Math.round(Number(c.timing.delay)));

  it("is the milliseconds between the units of a text entrance", () => {
    stub();
    mount(document.createElement("div"), text({ on: "load", target: "chars", preset: "fade-chars", duration: 600, stagger: 80 }));
    expect(delays()).toEqual([0, 80, 160]);
  });

  it("wins over params.speed, and the delay still shifts the first unit", () => {
    stub();
    mount(document.createElement("div"), text({ on: "load", target: "chars", preset: "fade-chars", duration: 600, stagger: 100, delay: 50, params: { speed: 0.5 } }));
    expect(delays()).toEqual([50, 150, 250]);
  });

  it("without it, params.speed (seconds) keeps spacing the units", () => {
    stub();
    mount(document.createElement("div"), text({ on: "load", target: "chars", preset: "fade-chars", duration: 600, params: { speed: 0.2 } }));
    expect(delays()).toEqual([0, 200, 400]);
  });

  it("counts units as params.speed does, so stagger 80 and speed 0.08 agree on words too", () => {
    stub();
    mount(document.createElement("div"), text({ on: "load", target: "words", preset: "rise-words", duration: 600, stagger: 80 }, "uno dos tres"));
    const withStagger = delays();
    calls.length = 0;
    mount(document.createElement("div"), text({ on: "load", target: "words", preset: "rise-words", duration: 600, params: { speed: 0.08 } }, "uno dos tres"));
    expect(withStagger).toHaveLength(3);
    expect(withStagger).toEqual(delays());
  });
});

describe("geometry.trim", () => {
  const star = (extra: Partial<Layer> = {}) =>
    shape({ id: "s", geometry: { kind: "preset", name: "star", trim: { start: 0.2, end: 0.7 } }, strokes: [{ paint: { kind: "color", value: "#ff0000" }, width: 4 }], ...extra } as Partial<Layer>);
  const figure = (scene: ReturnType<typeof mount>) => scene.elementOf("s")!.querySelector("svg[data-oim-figure] > *")!;

  it("draws only that share of the outline: pathLength 1 and a dash", () => {
    const path = figure(mount(document.createElement("div"), doc([star()])));
    expect(path.getAttribute("pathLength")).toBe("1");
    expect(path.getAttribute("stroke-dasharray")).toBe("0.5 2");
    expect(path.getAttribute("stroke-dashoffset")).toBe("-0.2");
  });

  it("a trimmed stroke scales with the figure instead of using non-scaling-stroke, which breaks pathLength in Chromium", () => {
    const scene = mount(document.createElement("div"), doc([star()]));
    const path = figure(scene);
    expect(path.hasAttribute("vector-effect")).toBe(false);
    const [, , vbW, vbH] = scene.elementOf("s")!.querySelector("svg[data-oim-figure]")!.getAttribute("viewBox")!.split(" ").map(Number);
    // The box is 500 x 100 canvas units; the stroke is 4: its width in viewBox units is the mean of both scales.
    expect(Number(path.getAttribute("stroke-width"))).toBeCloseTo((4 * (vbW / 500 + vbH / 100)) / 2, 3);
  });

  it("a trim track on a shape with no static trim still prepares the outline", () => {
    const track = { property: "trimEnd", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] };
    for (const geometry of [{ kind: "preset", name: "star" }, { kind: "preset", name: "star", trim: { start: 0, end: 1 } }]) {
      const path = figure(mount(document.createElement("div"), doc([star({ geometry, animations: [{ on: "load", duration: 500, tracks: [track] }] } as Partial<Layer>)])));
      expect(path.getAttribute("pathLength")).toBe("1");
      expect(path.hasAttribute("vector-effect")).toBe(false);
      expect(path.getAttribute("stroke-dasharray")).toBe("1 2");
    }
  });

  it("a trimmed stroke drops a dashed or dotted style", () => {
    const path = figure(mount(document.createElement("div"), doc([star({ strokes: [{ paint: { kind: "color", value: "#f00" }, width: 4, style: "dashed" }] } as Partial<Layer>)])));
    expect(path.getAttribute("stroke-dasharray")).toBe("0.5 2");
  });

  it("an untrimmed shape keeps its plain stroke", () => {
    const path = figure(mount(document.createElement("div"), doc([star({ geometry: { kind: "preset", name: "star" } } as Partial<Layer>)])));
    expect(path.hasAttribute("pathLength")).toBe(false);
    expect(path.hasAttribute("stroke-dasharray")).toBe(false);
    // The stroke scales with the figure, as in the editor at any zoom (Josué, 21 Nov 2026).
    expect(path.hasAttribute("vector-effect")).toBe(false);
  });

  it("the trimEnd and trimStart tracks animate the outline's dash, not the layer's box", () => {
    stub();
    mount(document.createElement("div"), doc([star({
      geometry: { kind: "preset", name: "star", trim: { start: 0, end: 1 } },
      animations: [{ on: "load", duration: 1000, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }, { property: "trimStart", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 0.5 }] }] }],
    } as Partial<Layer>)]));
    expect(calls.map((c) => c.tag)).toEqual(["path"]);
    expect(calls[0].timing).toMatchObject({ duration: 1000, fill: "both" });
    expect(calls[0].frames).toEqual([
      { offset: 0, strokeDasharray: "0 2", strokeDashoffset: "0" },
      { offset: 1, strokeDasharray: "0.5 2", strokeDashoffset: "-0.5" },
    ]);
  });

  it("a track the animation lacks keeps the trim at rest", () => {
    stub();
    mount(document.createElement("div"), doc([star({
      animations: [{ on: "load", duration: 400, tracks: [{ property: "trimStart", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 0.5 }] }] }],
    } as Partial<Layer>)]));
    expect(calls[0].frames).toEqual([
      { offset: 0, strokeDasharray: "0.7 2", strokeDashoffset: "0" },
      { offset: 1, strokeDasharray: "0.2 2", strokeDashoffset: "-0.5" },
    ]);
    calls.length = 0;
    mount(document.createElement("div"), doc([star({
      animations: [{ on: "load", duration: 400, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] }],
    } as Partial<Layer>)]));
    expect(calls[0].frames).toEqual([
      { offset: 0, strokeDasharray: "0 2", strokeDashoffset: "-0.2" },
      { offset: 1, strokeDasharray: "0.8 2", strokeDashoffset: "-0.2" },
    ]);
  });

  it("a keyframe's easing shapes the segment it starts, as on the box", () => {
    stub();
    mount(document.createElement("div"), doc([star({
      animations: [{ on: "load", duration: 400, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: 0, e: "ease-out" }, { t: 1, v: 1 }] }] }],
    } as Partial<Layer>)]));
    expect(calls[0].frames[0]).toMatchObject({ offset: 0, easing: "ease-out" });
    expect(calls[0].frames[1]).not.toHaveProperty("easing");
  });

  it("a hover draws the outline on entering and takes it back on leaving", () => {
    stub();
    const scene = mount(document.createElement("div"), doc([star({
      animations: [{ on: "hover", duration: 300, tracks: [{ property: "trimEnd", keyframes: [{ t: 0, v: 0.5 }, { t: 1, v: 1 }] }] }],
    } as Partial<Layer>)]));
    scene.elementOf("s")!.dispatchEvent(new Event("pointerenter"));
    expect(calls.map((c) => c.tag)).toEqual(["path"]);
    scene.elementOf("s")!.dispatchEvent(new Event("pointerleave"));
    expect(calls[0].run.reverse).toHaveBeenCalledTimes(1);
  });

  it("a track beside a trim track still animates the box", () => {
    stub();
    mount(document.createElement("div"), doc([star({
      animations: [{ on: "load", duration: 500, tracks: [{ property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }, { property: "trimEnd", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] }],
    } as Partial<Layer>)]));
    expect(calls.map((c) => c.tag).sort()).toEqual(["div", "path"]);
    expect(calls.find((c) => c.tag === "div")!.frames).toEqual([{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }]);
  });
});

describe("a cutout mask inside a group", () => {
  const group = () => shape({
    id: "g", type: "group", geometry: undefined, box: { x: 100, y: 50, width: 400, height: 300 },
    children: [
      shape({ id: "cover", box: { x: 100, y: 50, width: 400, height: 300 } }),
      shape({ id: "cut", geometry: { kind: "preset", name: "star" }, mask: { mode: "cutout" }, box: { x: 150, y: 90, width: 200, height: 200 } } as Partial<Layer>),
      shape({ id: "after", box: { x: 0, y: 0, width: 10, height: 10 } }),
    ],
  } as Partial<Layer>);

  it("clips the group's earlier children in the group's own units, and leaves the later ones alone", () => {
    const host = document.createElement("div");
    const scene = mount(host, doc([group()]));
    const wrapper = host.querySelector<HTMLElement>('[data-oim-cutout="cut"]')!;
    expect(scene.elementOf("g")!.contains(wrapper)).toBe(true);
    expect(wrapper.contains(scene.elementOf("cover"))).toBe(true);
    expect(wrapper.contains(scene.elementOf("after"))).toBe(false);
    expect(scene.elementOf("cut")).toBeNull();
    const d = host.querySelector(`${wrapper.style.clipPath.slice(4, -1).replace(/"/g, "")} path`)!.getAttribute("d")!;
    // Boxes are canvas units: the cutout at (150, 90) lies at (50, 40) inside the group at (100, 50).
    expect(d.startsWith("M0 0H400V300H0Z M50 40H250V240H50Z")).toBe(true); // the group, the box, then the figure
  });

  it("a cutout with nothing before it in the group paints nothing and does not throw", () => {
    const only = shape({ id: "g", type: "group", geometry: undefined, box: { x: 0, y: 0, width: 100, height: 100 }, children: [shape({ id: "cut", mask: { mode: "cutout" }, box: { x: 0, y: 0, width: 50, height: 50 } } as Partial<Layer>)] } as Partial<Layer>);
    expect(() => mount(document.createElement("div"), doc([only]))).not.toThrow();
  });
});
