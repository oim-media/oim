/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, layer animation: the timeline, the named loop and the named hover come from the 2.0 layer.
import { afterEach, describe, expect, it, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";
import { keyframesToWaapi, tracksToWaapi } from "../../../scene/src/legacy/renderer.js";
import { upgrade } from "../../../core/src/v2/upgrade.js";

const animate = HTMLElement.prototype.animate;
afterEach(() => { HTMLElement.prototype.animate = animate; });

async function render(animation: object, edit: (layer: any) => void) {
  const calls: { frames: any[]; options: any }[] = [];
  HTMLElement.prototype.animate = vi.fn(function (frames: any, options: any) {
    calls.push({ frames, options });
    return { pause() {}, play() {}, cancel() {}, currentTime: 0 } as any;
  }) as any;
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "a", type: "geo", position: [10, 10], content: { es: "" }, style: { width: 10, height: 10, animation } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old animation would run.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  return { el: shadow.querySelector('[data-slot-id="a"]') as HTMLElement, calls };
}

describe("a layer animates from its 2.0 layer", () => {
  it("its timeline: tracks, duration and what starts it", async () => {
    const { calls } = await render({ duration: 2, keyframes: [{ t: 0, x: 0 }, { t: 2, x: 50 }] }, (l) => {
      l.animations = [{ on: "action", duration: 3000, tracks: [{ property: "y", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 9 }] }] }];
    });
    const timeline = calls.find((c) => c.options?.duration === 3000)!;
    expect(timeline.options).toMatchObject({ iterations: 1, fill: "both", easing: "linear" });
    expect(timeline.frames).toEqual([
      { offset: 0, transform: "translate(0px, 0px) rotate(0deg) scale(1)" },
      { offset: 1, transform: "translate(0px, 9px) rotate(0deg) scale(1)" },
    ]);
  });

  it("its named loop, with its own duration and delay, and its named hover", async () => {
    const { el } = await render({ loop: "pulse", hover: "grow", duration: 9, delay: 9 }, (l) => {
      l.animations = [{ on: "loop", preset: "float", duration: 2200, delay: 500 }, { on: "hover", preset: "lift", duration: 200 }];
    });
    const loop = el.querySelector(".oim-loop-float") as HTMLElement;
    expect(loop.style.getPropertyValue("--oim-loop-duration")).toBe("2.2s");
    expect(loop.style.getPropertyValue("--oim-loop-delay")).toBe("0.5s");
    expect(el.querySelector(".oim-hover-lift")).toBeTruthy();
    expect(el.querySelector(".oim-loop-pulse, .oim-hover-grow")).toBeNull();
  });

  it("no animations in 2.0, nothing runs, whatever 1.x said", async () => {
    const { el, calls } = await render({ loop: "pulse", duration: 2, keyframes: [{ t: 0, x: 0 }, { t: 2, x: 50 }] }, (l) => { delete l.animations; });
    expect(el.querySelector(".oim-loop-pulse")).toBeNull();
    expect(calls.filter((c) => c.options?.iterations === Infinity)).toEqual([]);
  });
});

describe("tracks with their own times", () => {
  it("a time only the opacity names carries no transform: the browser interpolates it", () => {
    expect(tracksToWaapi([
      { property: "x", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 10 }] },
      { property: "opacity", keyframes: [{ t: 0, v: 1 }, { t: 0.5, v: 0 }, { t: 1, v: 1 }] },
    ])).toEqual([
      { offset: 0, opacity: 1, transform: "translate(0px, 0px) rotate(0deg) scale(1)" },
      { offset: 0.5, opacity: 0 },
      { offset: 1, opacity: 1, transform: "translate(10px, 0px) rotate(0deg) scale(1)" },
    ]);
  });

  it("a track silent where another moves is read on its own line", () => {
    expect(tracksToWaapi([
      { property: "x", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 10 }] },
      { property: "y", keyframes: [{ t: 0, v: 0 }, { t: 0.5, v: 4 }, { t: 1, v: 0 }] },
    ])[1]).toEqual({ offset: 0.5, transform: "translate(5px, 4px) rotate(0deg) scale(1)" });
  });
});

describe("the same keyframes by both roads", () => {
  // The 1.x keyframes straight to the browser, and through upgrade's tracks: one result.
  it.each([
    [[{ t: 0, o: 0, y: 35, s: 1, r: 0, x: 0 }, { t: 0.45, o: 0, y: 35, e: [0.16, 1, 0.3, 1] }, { t: 2, o: 1, y: 0 }], 2],
    [[{ t: 0, x: 10, r: 5, o: 1, b: 0 }, { t: 1, s: 1.5 }, { t: 3, o: 0.2 }, { t: 4, x: 10, r: 5, b: 3, e: "ease-in" }], 4],
  ])("case %#", (keyframes, duration) => {
    const doc = { oim: "1.27.9", canvas: { natural_width: 100, natural_height: 100 }, slots: [{ id: "a", type: "geo", position: [0, 0], style: { width: 10, height: 10, animation: { duration, keyframes } } }] };
    const tracks = upgrade(doc).document.layers[0].animations![0].tracks!;
    expect(tracksToWaapi(tracks)).toEqual(keyframesToWaapi(keyframes, duration));
  });
});
