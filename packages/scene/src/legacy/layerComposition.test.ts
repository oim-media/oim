/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { computeLayerComposition, getFilterCss, getMaskPathData, getMaskSilhouettePath, MASK_SHAPE_PATHS, getMaskClipPathD, getWindowMaskCanvasD } from "./layerComposition";
import type { Slot } from "./layerComposition";

function makeSlot(overrides: Partial<Slot> & { style?: Record<string, any> }): Slot {
  return {
    id: overrides.id || "s1",
    type: overrides.type || "geo",
    style: overrides.style || {},
    ...overrides
  };
}

describe("getMaskClipPathD", () => {
  const artboard = { width: 800, height: 600 };

  /**
   * The geometry of a .oim slot does NOT live in `style`: the position travels in
   * `position: [xPorcentaje, yPorcentaje]` and the size in `width_px`/`height_px`.
   * These tests use that real shape, not the editor's: it is the only way to
   * verify what the viewer actually receives.
   *
   * The chosen percentages are exact over 800x600 (12.5% -> 100px,
   * 10% -> 60px) so the comparison does not depend on floating point.
   */
  function makeMask(extra: Record<string, any> = {}) {
    return {
      id: "m",
      type: "mask",
      position: [12.5, 10],
      width_px: 200,
      height_px: 200,
      style: { maskShape: "rectangle", ...extra }
    } as any;
  }

  it("carries the three sub-paths in order: canvas, box, silhouette", () => {
    const d = getMaskClipPathD(makeMask(), artboard);
    expect(d.startsWith("M0 0H800V600H0Z ")).toBe(true);
    expect(d).toContain("M100 60H300V260H100Z");
  });

  it("situa la silueta en la caja de la mascara, no en el origen", () => {
    const d = getMaskClipPathD(makeMask(), artboard);
    expect(d).toContain("100 60");
    expect(d).toContain("300 260");
  });

  it("a mask covering the entire canvas leaves the box equal to the canvas", () => {
    const mask = { id: "m", type: "mask", position: [0, 0], width_px: 800, height_px: 600, style: { maskShape: "rectangle" } } as any;
    const d = getMaskClipPathD(mask, artboard);
    expect(d.startsWith("M0 0H800V600H0Z M0 0H800V600H0Z")).toBe(true);
  });

  it("uses the circular silhouette by default when there is no maskShape", () => {
    const mask = { id: "m", type: "mask", position: [0, 0], width_px: 100, height_px: 100, style: {} } as any;
    expect(getMaskClipPathD(mask, artboard).split(" ").length).toBeGreaterThan(10);
  });

  it("soporta multiples recortes vectoriales en cuts", () => {
    const mask = {
      id: "m",
      type: "mask",
      position: [0, 0],
      width_px: 800,
      height_px: 600,
      cuts: [
        { id: "c1", x: 10, y: 10, width: 100, height: 100, shape: "rectangle" },
        { id: "c2", x: 200, y: 200, width: 50, height: 50, shape: "rectangle" }
      ]
    } as any;
    const d = getMaskClipPathD(mask, artboard);
    expect(d).toContain("10 10");
    expect(d).toContain("200 200");
  });

  it("a slot without position or size does not break: it produces zeros, not NaN", () => {
    const mask = { id: "m", type: "mask", style: { maskShape: "rectangle" } } as any;
    const d = getMaskClipPathD(mask, artboard);
    expect(d).not.toContain("NaN");
    expect(d).not.toContain("undefined");
  });
});

describe("computeLayerComposition", () => {
  it("returns one shape node per plain shape when there is no mask/filter", () => {
    const slots = [makeSlot({ id: "a" }), makeSlot({ id: "b" })];
    const result = computeLayerComposition(slots);
    expect(result).toEqual([
      { kind: "shape", shape: slots[0] },
      { kind: "shape", shape: slots[1] }
    ]);
  });

  it("a mask layer clips the preceding shapes in cutout mode", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "circle" } });
    const result = computeLayerComposition([bg, mask]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("shape");
    expect((result[0] as any).shape.id).toBe("bg");
    expect(result[0].clipPath).toContain("mask-clip-mask");
  });

  it("a mask with no preceding shape is a no-op (nothing to clip)", () => {
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "circle" } });
    const result = computeLayerComposition([mask]);
    expect(result).toEqual([]);
  });

  it("two masks stacked directly on each other: the second mask wraps the clipped node", () => {
    const bg = makeSlot({ id: "bg" });
    const maskA = makeSlot({ id: "maskA", type: "mask", style: { maskMode: "cutout", geoShape: "circle" } });
    const maskB = makeSlot({ id: "maskB", type: "mask", style: { maskMode: "cutout", geoShape: "star" } });
    const result = computeLayerComposition([bg, maskA, maskB]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("filterGroup");
    expect(result[0].clipPath).toContain("mask-clip-maskB");
  });

  it("a filter layer is returned as a standard shape node with backdrop-filter capabilities", () => {
    const bg = makeSlot({ id: "bg" });
    const text = makeSlot({ id: "text", type: "text" });
    const filter = makeSlot({ id: "f1", type: "filter", style: { filterPreset: "sepia" } });
    const result = computeLayerComposition([bg, text, filter]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ kind: "shape", shape: bg });
    expect(result[1]).toEqual({ kind: "shape", shape: text });
    expect(result[2]).toEqual({ kind: "shape", shape: filter });
  });

  it("a mask directly above a filter clips the filter layer and background", () => {
    const bg = makeSlot({ id: "bg" });
    const f1 = makeSlot({ id: "f1", type: "filter", style: { filterPreset: "grayscale" } });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "heart" } });
    const result = computeLayerComposition([bg, f1, mask]);
    expect(result).toHaveLength(2);
    expect(result[0].clipPath).toContain("mask-clip-mask");
    expect(result[1].clipPath).toContain("mask-clip-mask");
  });
});

describe("getFilterCss", () => {
  it("returns undefined for 'none'", () => {
    expect(getFilterCss("none")).toBeUndefined();
  });

  it("returns undefined for 'duotone' (handled separately via SVG filter)", () => {
    expect(getFilterCss("duotone")).toBeUndefined();
  });

  it("returns a grayscale CSS filter string", () => {
    expect(getFilterCss("grayscale")).toBe("grayscale(1)");
  });

  it("returns a sepia CSS filter string", () => {
    expect(getFilterCss("sepia")).toBe("sepia(0.8)");
  });

  it("composes preset and manual filter controls from slot style", () => {
    const slot = makeSlot({
      style: {
        filterPreset: "sepia",
        filterBlur: 5,
        filterBrightness: 120,
        filterContrast: 110,
        filterSaturate: 130,
        filterHueRotate: 15
      }
    });
    expect(getFilterCss(slot)).toBe("sepia(0.8) blur(5px) brightness(120%) contrast(110%) saturate(130%) hue-rotate(15deg)");
  });

  it("returns undefined for an unknown preset", () => {
    expect(getFilterCss("not-a-real-preset")).toBeUndefined();
  });
});

describe("getMaskPathData", () => {
  it("returns the preset path for a known geoShape", () => {
    const slot = makeSlot({ style: { geoShape: "circle" } });
    expect(getMaskPathData(slot)).toBe(MASK_SHAPE_PATHS.circle);
  });

  it("returns the shape's own svgPath when geoShape is 'custom' or absent and svgPath is set", () => {
    const slot = makeSlot({ style: { geoShape: undefined, svgPath: "M0 0 L10 10 Z" } });
    expect(getMaskPathData(slot)).toBe("M0 0 L10 10 Z");
  });

  it("falls back to the circle preset when nothing else is available", () => {
    const slot = makeSlot({ style: { geoShape: undefined, svgPath: undefined } });
    expect(getMaskPathData(slot)).toBe(MASK_SHAPE_PATHS.circle);
  });
});

describe("getMaskPathData with inversion", () => {
  it("without inverting it returns only the shape", () => {
    const slot = makeSlot({ style: { isMaskLayer: true, geoShape: "circle" } });
    expect(getMaskPathData(slot).startsWith("M0 0H100V100H0Z")).toBe(false);
  });

  it("inverted prepends the canvas rectangle", () => {
    const slot = makeSlot({ style: { isMaskLayer: true, geoShape: "circle", maskInvert: true } });
    expect(getMaskPathData(slot).startsWith("M0 0H100V100H0Z ")).toBe(true);
    expect(getMaskPathData(slot).length).toBeGreaterThan("M0 0H100V100H0Z ".length);
  });
});

/**
 * Mirrors the editor's "computeLayerComposition with feather" suite.
 *
 * The editor and the player implement the same rule separately (feather uses
 * `mask-image`, no feather uses `clip-path`). These tests are what stops one
 * from moving without the other.
 *
 * It already happened with the sine wave: implemented twice, it came out in
 * opposite directions, and 224 tests passed because both agreed on the first
 * character.
 */
describe("computeLayerComposition with feather", () => {
  it("without feather it returns clipPath as before", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "circle" } });
    const result = computeLayerComposition([bg, mask]);
    expect(result[0].clipPath).toContain("mask-clip-mask");
    expect((result[0] as any).maskStyle).toBeUndefined();
  });

  it("with feather it returns maskStyle instead of clipPath", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "circle", maskFeather: 10 } });
    const result = computeLayerComposition([bg, mask]);
    expect(result[0].clipPath).toBeUndefined();
    expect((result[0] as any).maskStyle).toContain("mask-feather-mask");
  });

  it("a feather of 0 is treated as no feather", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", geoShape: "circle", maskFeather: 0 } });
    const result = computeLayerComposition([bg, mask]);
    expect(result[0].clipPath).toContain("mask-clip-mask");
    expect((result[0] as any).maskStyle).toBeUndefined();
  });
});

/**
 * Mirrors the editor's dedicated-mask suites. Same cases, same values.
 *
 * The viewer did not know the 'mask' type: such a slot fell through to the
 * `return null` of ImageEngine and disappeared entirely, even though the .oim
 * carried it and the exported PNG showed it. These tests pin the contract on both sides.
 */
describe("computeLayerComposition with a dedicated mask (type 'mask')", () => {
  it("in mode window it generates its own visible node without clipping the predecessor", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "window", maskShape: "heart", maskBgColor: "#38BDF8" } });
    const result = computeLayerComposition([bg, mask]);
    expect(result).toHaveLength(2);
    expect((result[1] as any).shape.id).toBe("mask");
    expect((result[1] as any).clipPath).toBeUndefined();
    expect((result[1] as any).maskStyle).toBeUndefined();
  });

  it("in mode window does not apply clipPath to the predecessor", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "window" } });
    const result = computeLayerComposition([bg, mask]);
    expect((result[0] as any).clipPath).toBeUndefined();
    expect((result[0] as any).maskStyle).toBeUndefined();
  });

  it("in mode cutout it clips the predecessor like an inherited mask", () => {
    const bg = makeSlot({ id: "bg" });
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "cutout", maskShape: "star" } });
    const result = computeLayerComposition([bg, mask]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).shape.id).toBe("bg");
    expect(result[0].clipPath).toContain("mask-clip-mask");
  });

  it("in mode window without a predecessor it still generates its visible node", () => {
    const mask = makeSlot({ id: "mask", type: "mask", style: { maskMode: "window" } });
    const result = computeLayerComposition([mask]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).shape.id).toBe("mask");
  });

  it("a dedicated mask without maskMode is window by default", () => {
    const mask = makeSlot({ id: "mask", type: "mask", style: {} });
    const result = computeLayerComposition([mask]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).shape.id).toBe("mask");
  });
});

describe("getMaskPathData with mode window vs cutout", () => {
  it("in mode window it prepends the canvas rectangle (evenodd parity)", () => {
    const slot = makeSlot({ type: "mask", style: { maskMode: "window", geoShape: "circle" } });
    const d = getMaskPathData(slot);
    expect(d.startsWith("M0 0H100V100H0Z ")).toBe(true);
    expect(d.length).toBeGreaterThan("M0 0H100V100H0Z ".length);
  });

  it("in mode cutout it returns only the silhouette without the outer rectangle", () => {
    const slot = makeSlot({ type: "mask", style: { maskMode: "cutout", geoShape: "circle" } });
    expect(getMaskPathData(slot)).toBe(MASK_SHAPE_PATHS.circle);
  });
});

describe("getMaskSilhouettePath", () => {
  it("returns the silhouette without the outer rectangle even if the mask is window", () => {
    const slot = makeSlot({ type: "mask", style: { maskMode: "window", maskShape: "star" } });
    expect(getMaskSilhouettePath(slot)).toBe(MASK_SHAPE_PATHS.star);
  });

  it("prefers maskShape over geoShape", () => {
    const slot = makeSlot({ style: { geoShape: "circle", maskShape: "heart" } });
    expect(getMaskSilhouettePath(slot)).toBe(MASK_SHAPE_PATHS.heart);
  });

  it("respects a custom maskSvgPath when maskShape is custom or missing", () => {
    const slot = makeSlot({ type: "mask", style: { maskSvgPath: "M0 0 L10 10 Z", maskShape: "custom" } });
    expect(getMaskSilhouettePath(slot)).toBe("M0 0 L10 10 Z");
  });
});

describe("getWindowMaskCanvasD — frame in canvas space", () => {
  const artboard = { width: 800, height: 1200 };

  it("the frame ALWAYS covers the entire canvas, not the mask's box", () => {
    // Small, off-centre mask: the frame must still be the canvas.
    const slot: any = {
      id: "m", type: "mask", position: [25, 25],
      width_px: 100, height_px: 100,
      style: { maskMode: "window", maskShape: "circle" }
    };
    const d = getWindowMaskCanvasD(slot, artboard);
    expect(d.startsWith("M0 0H800V1200H0Z ")).toBe(true);
  });

  it("leaves no gap even if the mask is smaller than the canvas", () => {
    // This was the bug: with the old model the frame measured what the box did,
    // so a small mask left the rest of the canvas uncovered.
    const chica: any = {
      id: "m", type: "mask", position: [10, 10], width_px: 50, height_px: 50,
      style: { maskMode: "window", maskShape: "circle" }
    };
    const grande: any = {
      id: "m", type: "mask", position: [0, 0], width_px: 800, height_px: 1200,
      style: { maskMode: "window", maskShape: "circle" }
    };
    const marco = "M0 0H800V1200H0Z ";
    expect(getWindowMaskCanvasD(chica, artboard).startsWith(marco)).toBe(true);
    expect(getWindowMaskCanvasD(grande, artboard).startsWith(marco)).toBe(true);
  });

  it("the gap follows the mask's position, not the canvas origin", () => {
    const a: any = { id: "m", type: "mask", position: [0, 0], width_px: 100, height_px: 100,
      style: { maskMode: "window", maskShape: "rectangle" } };
    const b: any = { id: "m", type: "mask", position: [50, 50], width_px: 100, height_px: 100,
      style: { maskMode: "window", maskShape: "rectangle" } };
    expect(getWindowMaskCanvasD(a, artboard)).not.toBe(getWindowMaskCanvasD(b, artboard));
  });

  it("supports multi-cut (cuts) while keeping the canvas frame", () => {
    const slot: any = {
      id: "m", type: "mask", position: [0, 0], width_px: 800, height_px: 1200,
      cuts: [
        { shape: "circle", x: 0, y: 0, width: 100, height: 100 },
        { shape: "circle", x: 200, y: 200, width: 100, height: 100 }
      ],
      style: { maskMode: "window" }
    };
    const d = getWindowMaskCanvasD(slot, artboard);
    expect(d.startsWith("M0 0H800V1200H0Z ")).toBe(true);
    // Two silhouettes => more than one sub-path after the frame
    expect(d.split("Z").length).toBeGreaterThan(3);
  });

  it("does not produce NaN when position and size are missing", () => {
    const slot: any = { id: "m", type: "mask", style: { maskMode: "window", maskShape: "circle" } };
    expect(getWindowMaskCanvasD(slot, artboard)).not.toContain("NaN");
  });
});

describe("getWindowMaskCanvasD — reach of the frame (maskCoverage)", () => {
  const artboard = { width: 800, height: 1200 };
  const base = (st: any = {}) => ({
    id: "m", type: "mask", position: [0, 0], width_px: 719, height_px: 1200,
    style: { maskMode: "window", maskShape: "circle", ...st }
  } as any);

  it("by default covers the entire canvas even if the box is smaller", () => {
    expect(getWindowMaskCanvasD(base(), artboard).startsWith("M0 0H800V1200H0Z ")).toBe(true);
  });

  it("with maskCoverage 'container' it is limited to the box", () => {
    const d = getWindowMaskCanvasD(base({ maskCoverage: "container" }), artboard);
    expect(d.startsWith("M0 0H719V1200H0Z ")).toBe(true);
  });

  it("an unknown value falls back to 'canvas', never leaving strips due to a typo", () => {
    expect(getWindowMaskCanvasD(base({ maskCoverage: "vaya" }), artboard).startsWith("M0 0H800V1200H0Z ")).toBe(true);
  });
});
