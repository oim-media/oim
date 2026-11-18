/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { geometryOutline, type Layer, type PaintColors } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { applyGeometry } from "./geometry.js";

const colors: PaintColors = { css: (v) => (typeof v === "string" ? v : undefined), literal: (v) => (typeof v === "string" ? v : undefined) };
const shape = (geometry: Layer["geometry"], extra: Partial<Layer> = {}) => ({ geometry, fills: [{ kind: "color", value: "#00ff00" }], ...extra }) as Layer;

describe("applyGeometry", () => {
  it("a rectangle is the box itself: nothing is drawn over it", () => {
    const el = document.createElement("div");
    expect(applyGeometry(el, shape({ kind: "rect" }), { colors }).silhouette).toBeNull();
    expect(el.querySelector("svg")).toBeNull();
  });

  it("a preset is drawn as the figure its outline gives, filled with the colour of its first colour fill", () => {
    const el = document.createElement("div");
    expect(applyGeometry(el, shape({ kind: "preset", name: "star" }), { colors }).silhouette).not.toBeNull();
    const svg = el.querySelector("svg")!;
    const figure = svg.firstElementChild!;
    const expected = geometryOutline({ kind: "preset", name: "star" } as Layer["geometry"]).silhouette!;
    expect(svg.getAttribute("viewBox")).toBe(expected.viewBox);
    expect(figure.getAttribute(expected.points ? "points" : "d")).toBe(expected.points ?? expected.d);
    expect(figure.getAttribute("fill")).toBe("#00ff00");
  });

  it("a star or polygon with its own kind is a box until the core has its outline", () => {
    const el = document.createElement("div");
    expect(applyGeometry(el, shape({ kind: "star", points: 5 } as Layer["geometry"]), { colors }).silhouette).toBeNull();
    expect(el.querySelector("svg")).toBeNull();
  });

  it("applying again replaces the figure", () => {
    const el = document.createElement("div");
    applyGeometry(el, shape({ kind: "preset", name: "star" }), { colors });
    applyGeometry(el, shape({ kind: "preset", name: "star" }), { colors });
    expect(el.querySelectorAll("svg")).toHaveLength(1);
  });

  it("a picture on a figure is clipped to the figure's silhouette, in the box's own units", () => {
    const el = document.createElement("div");
    const img = el.appendChild(document.createElement("img"));
    img.dataset.oimFill = "";
    applyGeometry(el, shape({ kind: "preset", name: "star" }, { fills: [{ kind: "image", src: "data:image/png;base64,AA==" }] }), { colors });
    const box = img.parentElement!;
    expect(box).not.toBe(el);
    const id = /url\(#(.+)\)/.exec(box.style.clipPath)![1];
    const clip = el.querySelector(`clipPath#${id}`)!;
    expect(clip.getAttribute("clipPathUnits")).toBe("objectBoundingBox");
    const expected = geometryOutline({ kind: "preset", name: "star" } as Layer["geometry"]).silhouette!;
    expect(clip.firstElementChild!.getAttribute("d")).toBe(expected.d ?? "M " + expected.points!.split(" ").join(" L ") + " Z");
  });
});
