/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @vitest-environment happy-dom
 *
 * The frame of a window mask paints the same fills a shape does. These tests
 * build the frame from the shape paint helpers (paintCss, mountImageFill), so a
 * gradient, a pattern, a dynamic role or a photo cannot be dropped on the way.
 */

import { describe, it, expect, vi } from "vitest";
import { buildLayerCompositionDefs, buildWindowMaskFrame } from "./renderer";
import { computeLayerComposition } from "../runtime/layerComposition";
import { paintCss } from "../../../core/src/v2/paint-css.js";
import { paintColors } from "../../../core/src/v2/colors.js";

const artboard = { width: 800, height: 600 };
const colors = paintColors({} as any);
const windowMask = {
  id: "m",
  type: "mask",
  x: 100,
  y: 60,
  width: 200,
  height: 200,
  style: { maskMode: "window", maskShape: "circle" },
} as any;

function paintOf(fill: any) {
  return paintCss(fill, { colors, width: artboard.width, height: artboard.height });
}

describe("window frame paint", () => {
  it("a pattern frame is tiled with the pattern, as a shape is", () => {
    const css = paintOf({ kind: "pattern", pattern: { preset: "dots", colors: ["#111111"], bg: "#ffffff" } });
    // The tile is an SVG data URI, which happy-dom does not keep on a style: the URL is checked on the paint CSS.
    expect(css.backgroundImage).toContain("url(");
    const frame = buildWindowMaskFrame(windowMask, artboard, { css })!;
    const paint = frame.querySelector(".oim-mask-paint") as HTMLElement;
    expect(paint.style.backgroundRepeat).toBe("repeat");
  });

  it("a gradient frame paints the gradient, as a shape does", () => {
    const css = paintOf({
      kind: "gradient",
      gradient: { type: "linear", angle: 90, stops: [{ color: "#000000" }, { color: "#ffffff" }] },
    });
    const frame = buildWindowMaskFrame(windowMask, artboard, { css })!;
    const paint = frame.querySelector(".oim-mask-paint") as HTMLElement;
    expect(paint.style.backgroundImage).toContain("linear-gradient");
  });

  it("a dynamic colour role without a palette falls back to its literal colour", () => {
    const css = paintOf({ kind: "color", value: { var: "primary", fallback: "#123456" } });
    // The role is a var() that a palette can override, with the literal as its fallback.
    expect(css.backgroundColor).toContain("#123456");
  });

  it("a photo frame mounts the picture inside the frame, over its colour", () => {
    const src = "data:image/png;base64,iVBORw0KGgo=";
    const frame = buildWindowMaskFrame(windowMask, artboard, {
      css: { backgroundColor: "#ffffff" },
      photo: { paint: { kind: "image", src }, src, underColor: "#ffffff" },
    })!;
    const img = frame.querySelector(".oim-image-fill img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe(src);
  });

  it("the paint is clipped to the frame with its hole, so the silhouette stays transparent", () => {
    const frame = buildWindowMaskFrame(windowMask, artboard, { css: { backgroundColor: "#123456" } })!;
    const paint = frame.querySelector(".oim-mask-paint") as HTMLElement;
    expect(paint.style.clipPath).toMatch(/^path\(evenodd, "M0 0H800V600H0Z/);
  });

  it("a mask whose outline cannot be drawn keeps its frame, with a hole the size of its box", () => {
    const unknown = { ...windowMask, style: { maskMode: "window", maskShape: "nope" } };
    const frame = buildWindowMaskFrame(unknown, artboard, { css: { backgroundColor: "#123456" } })!;
    const paint = frame.querySelector(".oim-mask-paint") as HTMLElement;
    expect(paint.style.clipPath).toMatch(/^path\(evenodd/);
    expect(paint.style.clipPath).toContain("M100 60H300V260H100Z");
  });

  it("a cutout mask with no drawable outline defines the clip or feather its layer references, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bg = { id: "bg", type: "image", x: 0, y: 0, width: 100, height: 100, style: {} } as any;
    const cases: [number, string][] = [
      [0, "clipPath"],
      [4, "maskStyle"],
    ];
    for (const [maskFeather, prop] of cases) {
      const cut = {
        id: "cut",
        type: "mask",
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        style: { maskMode: "cutout", maskShape: "nope", maskFeather },
      } as any;
      const defs = buildLayerCompositionDefs([bg, cut], { width: 100, height: 100 });
      const [node] = computeLayerComposition([bg, cut]) as any[];
      const ref = String(node[prop]).match(/url\(#([^)]+)\)/)![1];
      expect(defs.querySelector(`#${ref}`), prop).not.toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
