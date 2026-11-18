/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment happy-dom

// A 2.0 drawing whose fill is a gradient paints that gradient inside its paths, as the
// editor does: it used to paint the gradient over the whole box (a coloured square).
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../scene/src/runtime/features-entry.js", () => ({ ensureFeatures: () => Promise.resolve() }));

import { legacyView } from "../../../scene/src/legacy/legacy-view.js";
import { ImageEngine } from "./ImageEngine";

const D = "M12 2L22 22H2Z";
const ICON_GEOMETRY = { kind: "paths", viewBox: [0, 0, 24, 24], paths: [{ d: D, fill: "currentColor" }] };
const doc = (fill: object, geometry: object = ICON_GEOMETRY) => ({
  oim: "2.0.0", canvas: { width: 100, height: 100 }, languages: ["es"],
  layers: [{ id: "icon", type: "shape", box: { x: 0, y: 0, width: 50, height: 50 }, fills: [fill], geometry }],
});

async function render(fill: object, geometry?: object): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const engine = new ImageEngine(host);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = legacyView(doc(fill, geometry) as any) as any;
  await engine.renderSlots();
  return engine._overlay.querySelector('[data-slot-id="icon"]') as HTMLElement ?? engine._overlay;
}

const gradient = { kind: "gradient", gradient: { type: "linear", angle: 90, stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }] } };

describe("a drawing with a gradient fill", () => {
  it("cuts the gradient to its paths and draws no opaque copy on top", async () => {
    const slot = await render(gradient);
    const painted = [slot, ...slot.querySelectorAll<HTMLElement>("*")].filter((el) => /gradient\(/.test(el.style.backgroundImage || el.style.background || ""));
    expect(painted.length).toBe(1);
    const mask = painted[0].style.maskImage || (painted[0].style as any).webkitMaskImage || "";
    expect(decodeURIComponent(mask)).toContain(D);
    const path = slot.querySelector("svg path") as SVGPathElement | null;
    if (path) expect(path.style.fill === "" || path.style.fill === "currentColor").toBe(false);
  });
});

// The cards Lottie cloud: its moving clouds pattern slid the cloud itself, because the
// pattern keyframes also move mask-position, and the fill layer's mask is the silhouette.
describe("a shape with a moving pattern fill", () => {
  it("moves the pattern, never the silhouette that cuts it", async () => {
    const pattern = { kind: "pattern", pattern: { preset: "clouds", bg: "#0284C7", colors: ["#FFFFFF"], motion: { direction: "left", period: 16 } } };
    const slot = await render(pattern, { kind: "preset", name: "cloud" });
    const els = [slot, ...slot.querySelectorAll<HTMLElement>("*")];
    const animated = els.filter((el) => /background-animation-left/.test(el.style.animation));
    expect(animated.length).toBe(1);
    const masked = els.filter((el) => (el.style.maskImage || (el.style as any).webkitMaskImage || "") !== "");
    expect(masked.length).toBeGreaterThan(0);
    for (const el of masked) expect(el.style.animation).toBe("");
  });
});
