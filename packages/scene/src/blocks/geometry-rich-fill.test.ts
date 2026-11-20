/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { mount } from "../index.js";

const radial = { kind: "gradient", gradient: { type: "radial", stops: [{ at: 0, color: "#FDBA74" }, { at: 1, color: "#B91C1C" }] } };
const icon = { kind: "paths", viewBox: [0, 0, 24, 24], paths: [{ d: "M2 2L22 2L12 22Z", fill: "currentColor" }] };

function paint(layer: object) {
  const host = document.createElement("div");
  mount(host, { oim: "2.0.0-draft.1", canvas: { width: 400, height: 200 }, languages: ["es"], layers: [{ id: "s", type: "shape", box: { x: 0, y: 0, width: 100, height: 100 }, ...layer }] } as never);
  return host.querySelector<HTMLElement>('[data-oim-id="s"]')!;
}
const mask = (el: HTMLElement) => el.style.getPropertyValue("mask-image") || el.style.getPropertyValue("-webkit-mask-image");

describe("a gradient, pattern or generative fill on a figure is cut to the figure", () => {
  it("a preset with a radial gradient keeps the gradient, masked by its silhouette", () => {
    const el = paint({ geometry: { kind: "preset", name: "cloud" }, fills: [radial] });
    expect(el.style.backgroundImage).toContain("radial-gradient");
    expect(mask(el)).toContain("data:image/svg+xml");
  });

  it("an icon with a gradient keeps the gradient, masked by its paths", () => {
    const el = paint({ geometry: icon, fills: [radial] });
    expect(el.style.backgroundImage).toContain("radial-gradient");
    expect(decodeURIComponent(mask(el))).toContain("M2 2L22 2L12 22Z");
  });

  it("a flat colour needs no mask: the figure itself is filled", () => {
    const el = paint({ geometry: { kind: "preset", name: "cloud" }, fills: [{ kind: "color", value: "#FDBA74" }] });
    expect(mask(el)).toBe("");
    expect(el.querySelector("svg path")!.getAttribute("fill")).toBe("#FDBA74");
  });
});
