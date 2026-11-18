/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Layer, OimDocument } from "@oim-media/core/v2";
import { afterEach, describe, expect, it, vi } from "vitest";

const registered = vi.hoisted(() => ({ calls: 0 }));
vi.mock("./blocks/fonts.js", async (real) => ({
  ...(await real<typeof import("./blocks/fonts.js")>()),
  registerEmbeddedFonts: async () => { registered.calls++; },
}));
import { mount } from "./index.js";

const shape = (o: Partial<Layer>): Layer => ({ type: "shape", box: { x: 0, y: 0, width: 100, height: 100 }, geometry: { kind: "rect" }, ...o } as Layer);
const doc = (layers: Layer[], extra: object = {}): OimDocument =>
  ({ oim: "2.0.0-draft.1", canvas: { width: 1000, height: 500 }, languages: ["es", "en"], layers, ...extra }) as OimDocument;
const showOnPress = () => doc([
  shape({ id: "panel", visible: false }),
  shape({ id: "btn", interactions: [{ on: "press", actions: [{ type: "show", target: "panel" }] }] } as Partial<Layer>),
]);

describe("what the host decides", () => {
  const realAnimate = HTMLElement.prototype.animate;
  afterEach(() => { HTMLElement.prototype.animate = realAnimate; registered.calls = 0; });

  it("disableActions: a press changes nothing and the host hears nothing", () => {
    const onAction = vi.fn(() => true);
    const scene = mount(document.createElement("div"), showOnPress(), { disableActions: true, onAction });
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("panel")!.style.display).toBe("none");
    expect(onAction).not.toHaveBeenCalled();
    expect(scene.elementOf("btn")!.style.cursor).toBe("");
  });

  it("the host hears each action and can veto it", () => {
    const onAction = vi.fn(() => false);
    const scene = mount(document.createElement("div"), showOnPress(), { onAction });
    scene.elementOf("btn")!.click();
    expect(onAction).toHaveBeenCalledWith({ type: "show", target: "panel" }, "btn");
    expect(scene.elementOf("panel")!.style.display).toBe("none");
    onAction.mockReturnValue(true);
    scene.elementOf("btn")!.click();
    expect(scene.elementOf("panel")!.style.display).toBe("");
  });

  it("setMode switches the language in place", () => {
    const text = { id: "t", type: "text", box: { x: 0, y: 0 }, text: { content: { es: "Hola", en: "Hello" } } } as Layer;
    const scene = mount(document.createElement("div"), doc([text]), { language: "es" });
    const node = scene.elementOf("t");
    scene.setMode({ language: "en" });
    expect(scene.elementOf("t")).toBe(node);
    expect(node!.textContent).toBe("Hello");
  });

  it("disableAnimations: born still, and play does not start it", () => {
    const runs: { play: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }[] = [];
    HTMLElement.prototype.animate = function () {
      const run = { play: vi.fn(), pause: vi.fn(), cancel: vi.fn(), finish: vi.fn() };
      runs.push(run);
      return run as unknown as Animation;
    } as typeof HTMLElement.prototype.animate;
    const loop = shape({ id: "a", animations: [{ on: "loop", tracks: [{ property: "opacity", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }], duration: 500, iterations: Infinity }] } as Partial<Layer>);
    const scene = mount(document.createElement("div"), doc([loop]), { disableAnimations: true });
    const root = scene.elementOf("a")!.parentElement!;
    root.getAnimations = () => runs as unknown as Animation[];
    scene.play();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].cancel).toHaveBeenCalled();
    expect(runs[0].play).not.toHaveBeenCalled();
  });

  it("registerFonts: false leaves the fonts to the host", () => {
    const fonts = [{ family: "Inter", name: "oim-f-Inter", weight: 400, style: "normal", format: "woff", data: "d09GRgABAAAA" }];
    mount(document.createElement("div"), doc([], { fonts }), { registerFonts: false });
    expect(registered.calls).toBe(0);
    mount(document.createElement("div"), doc([], { fonts }));
    expect(registered.calls).toBe(1);
  });
});
