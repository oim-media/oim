/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { paintColors, type Layer, type Paint } from "@oim-media/core/v2";
import { describe, expect, it } from "vitest";
import { applyFills, type PaintContext } from "./fills.js";

const colors: PaintContext["colors"] = {
  css: (v) => (typeof v === "string" ? v : undefined),
  literal: (v) => (typeof v === "string" ? v : undefined),
};
const ctx: PaintContext = { colors, isText: false };
const paint = (fills: Layer["fills"]) => {
  const el = document.createElement("div");
  applyFills(el, { fills }, ctx);
  return el;
};
const grad = (from: string, to: string) => ({ kind: "gradient", gradient: { type: "linear", angle: 90, stops: [{ color: from }, { color: to }] } }) as Paint;

// The browser normalises a colour (#ff0000 becomes rgb()): compare with what the element keeps.
const kept = (color: string) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = color;
  return probe.style.backgroundColor;
};

describe("applyFills", () => {
  it("a colour fill is the element's background colour", () => {
    expect(paint([{ kind: "color", value: "#ff0000" }]).style.backgroundColor).toBe(kept("#ff0000"));
  });

  it("two paints are background layers, the top one first (fills are painted bottom to top)", () => {
    const el = paint([grad("#111111", "#222222"), grad("#333333", "#444444")]);
    const layers = el.style.backgroundImage.split(/,\s(?=linear-gradient)/);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toContain("#333333");
    expect(layers[1]).toContain("#111111");
  });

  it("a colour under a gradient stays the background colour; a colour above one becomes a layer", () => {
    const under = paint([{ kind: "color", value: "#ffffff" }, grad("#000000", "#111111")]);
    expect(under.style.backgroundColor).toBe(kept("#ffffff"));
    expect(under.style.backgroundImage).toContain("linear-gradient");
    const over = paint([grad("#000000", "#111111"), { kind: "color", value: "#ffffff" }]);
    expect(over.style.backgroundImage).toContain("linear-gradient(#ffffff, #ffffff)");
  });

  it("a reference that names nothing paints nothing and does not throw", () => {
    const el = paint([{ ref: "missing" } as never]);
    expect(el.style.backgroundColor).toBe("");
    expect(el.style.backgroundImage).toBe("");
  });

  it("applying again replaces the earlier fills", () => {
    const el = document.createElement("div");
    applyFills(el, { fills: [{ kind: "color", value: "#ff0000" }] }, ctx);
    applyFills(el, { fills: [{ kind: "color", value: "#00ff00" }] }, ctx);
    expect(el.style.backgroundColor).toBe(kept("#00ff00"));
  });

  it("a cropped picture is zoomed inside its layer, so the layer clips what spills out", () => {
    const el = paint([{ kind: "image", src: "data:image/png;base64,AA==", crop: { x: 20, y: 70, zoom: 2 } }]);
    expect(el.style.overflow).toBe("hidden");
    expect(el.querySelector("img")!.style.transform).toBe("scale(2)");
  });

  it("an image paint is a picture node above the background, and a data: picture only", () => {
    const el = paint([{ kind: "image", src: "data:image/png;base64,AA==", fit: "contain" }]);
    const img = el.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.position).toBe("absolute");
  });

  it("a pattern tile keeps the core's size, in the element's own units, under its scale", () => {
    const el = document.createElement("div");
    applyFills(el, { fills: [{ kind: "pattern", pattern: { preset: "stars", scale: 1.5, colors: ["#1d4ed8"] } }] }, { ...ctx, size: (px) => `${px / 8}% ${px / 6}%` });
    expect(el.style.backgroundSize).toBe("30% 40%");
  });
});

describe("generative fill", () => {
  it("is drawn for the layer's own size, so a wide layer is not a cropped square", () => {
    const generative = { generatorId: "stacked-waves", seed: 7, params: {}, colors: { mode: "palette", stops: ["#f59e0b", "#7c3aed"], direction: "forward", background: "#0f172a", backgroundVisible: true } };
    const paint = (width: number, height: number) => {
      const el = document.createElement("div");
      applyFills(el, { fills: [{ kind: "generative", generative }] } as never, { colors: paintColors({}), isText: false, width, height });
      return decodeURIComponent(el.style.backgroundImage);
    };
    expect(paint(600, 400)).toContain(`width="600"`);
    expect(paint(600, 400)).not.toBe(paint(400, 400));
  });
});

