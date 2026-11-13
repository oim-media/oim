/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, entrance and trim: both come from the 2.0 layer's animations.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

// happy-dom measures no path: every one is 100 long here.
const pathProto = Object.getPrototypeOf(document.createElementNS("http://www.w3.org/2000/svg", "path"));
const realLength = Object.getOwnPropertyDescriptor(pathProto, "getTotalLength");
beforeEach(() => { Object.defineProperty(pathProto, "getTotalLength", { value: () => 100, configurable: true }); });
afterEach(() => {
  if (realLength) Object.defineProperty(pathProto, "getTotalLength", realLength);
  else delete pathProto.getTotalLength;
});

async function render(slot: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  shadow.appendChild(engine._viewport);
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  engine.lang = "es";
  engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots: [{ id: "a", position: [10, 10], ...slot }] };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old value would show.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="a"]') as HTMLElement;
}

const icon = (style: object) => ({
  type: "svg",
  content: { es: '<svg viewBox="0 0 10 10"><path d="M0 0h10" stroke="#000"/></svg>' },
  style: { width: 100, height: 100, strokeWidth: 2, ...style },
});

describe("how a layer enters comes from its 2.0 layer", () => {
  it("its enter animation", async () => {
    const el = await render({ type: "geo", content: { es: "" }, style: { width: 10, height: 10, reveal: { effect: "fade", duration: 100 } } }, (l) => {
      l.animations = [{ on: "enter", preset: "slide-up", duration: 400, easing: "ease-in" }];
    });
    expect((el as any)._oimReveal).toEqual({ effect: "slide-up", duration: 400, easing: "ease-in" });
  });

  it("none in 2.0: the default fade, whatever 1.x said", async () => {
    const el = await render({ type: "geo", content: { es: "" }, style: { width: 10, height: 10, reveal: { effect: "scale", duration: 100 } } }, (l) => { delete l.animations; });
    expect((el as any)._oimReveal).toBeUndefined();
  });
});

describe("a stroke's trim comes from its 2.0 layer", () => {
  it("at rest, from the geometry, with nothing animated", async () => {
    const el = await render(icon({ trimDuration: 9 }), (l) => { delete l.animations; l.geometry.trim = { start: 0.25, end: 0.75 }; });
    const path = el.querySelector("path") as unknown as HTMLElement;
    expect(path.style.strokeDasharray).toBe("50 100");
    expect(path.style.strokeDashoffset).toBe("-25");
    expect(path.style.animation).toBe("");
  });

  it("drawn over time, for as long as its load animation says", async () => {
    const el = await render(icon({ trimStart: 0, trimEnd: 100, trimDuration: 9 }), (l) => {
      l.geometry.trim = { end: 0.5 };
      l.animations[0].duration = 2000;
    });
    const path = el.querySelector("path") as unknown as HTMLElement;
    expect(path.style.strokeDasharray).toBe("50 100");
    expect(path.style.animation).toContain("2s");
  });

  it("none in 2.0, nothing trimmed, whatever 1.x said", async () => {
    const el = await render(icon({ trimStart: 25, trimEnd: 75 }), (l) => { delete l.geometry.trim; });
    expect((el.querySelector("path") as unknown as HTMLElement).style.strokeDasharray).toBe("");
  });
});
