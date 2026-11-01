/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES, FRAME_SHAPES } from "./geoShapes";
import { frameSilhouette, usesFrameShapes } from "./frame-silhouette";
import { styleSchema } from "./schema";

const NEW_SHAPES = [
  "pill", "octagon", "pentagon", "cross", "moon", "cloud", "drop",
  "bolt", "bubble", "flower", "burst", "arch",
];

/** All the numbers of a path; with only absolute M/L/C/Z they come in x,y pairs. */
const numbers = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("the twelve new catalog shapes", () => {
  it("they are all in GEO_SHAPES", () => {
    expect(NEW_SHAPES.filter((n) => !(n in GEO_SHAPES))).toEqual([]);
  });

  it("they are closed and fillable", () => {
    for (const name of NEW_SHAPES) {
      const d = GEO_SHAPES[name];
      if (d.tipo === "path") expect(d.rellenable, name).toBe(true);
    }
  });

  it("all their coordinates fall within 0-100", () => {
    for (const name of NEW_SHAPES) {
      const d = GEO_SHAPES[name];
      const values = d.tipo === "polygon"
        ? d.puntos.flat()
        : numbers(d.d);
      for (const v of values) {
        expect(v, `${name} overflows the viewBox`).toBeGreaterThanOrEqual(0);
        expect(v, `${name} overflows the viewBox`).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("FRAME_SHAPES", () => {
  it("starts with the rectangle and excludes the line and the scribble", () => {
    expect(FRAME_SHAPES[0]).toBe("rectangle");
    expect(FRAME_SHAPES).not.toContain("line");
    expect(FRAME_SHAPES).not.toContain("scribble");
  });

  it("includes the twelve new shapes", () => {
    expect(NEW_SHAPES.filter((n) => !FRAME_SHAPES.includes(n))).toEqual([]);
  });
});

describe("frameSilhouette", () => {
  it("a catalog shape yields its path", () => {
    const s = frameSilhouette({ geoShape: "cloud" });
    expect(s).not.toBeNull();
    expect(s!.d).toBe((GEO_SHAPES.cloud as { d: string }).d);
    expect(s!.viewBox).toBe("0 0 100 100");
  });

  it("a polygon shape yields its points", () => {
    const s = frameSilhouette({ geoShape: "octagon" });
    expect(s!.points).toContain("30,5");
    expect(s!.d).toBeUndefined();
  });

  it("an svgPath is returned as is, with the default viewBox", () => {
    expect(frameSilhouette({ svgPath: "M0 0L100 0L50 100Z" })).toEqual({
      d: "M0 0L100 0L50 100Z",
      viewBox: "0 0 100 100",
    });
  });

  it("an svgPath uses its svgViewBox when it has one", () => {
    expect(frameSilhouette({ svgPath: "M0 0Z", svgViewBox: "0 0 24 24" })!.viewBox).toBe("0 0 24 24");
  });

  it("the blob uses customBlobPath, then svgPath, then the catalog", () => {
    expect(frameSilhouette({ geoShape: "blob", customBlobPath: "M1 1Z", svgPath: "M2 2Z" })!.d).toBe("M1 1Z");
    expect(frameSilhouette({ geoShape: "blob", svgPath: "M2 2Z" })!.d).toBe("M2 2Z");
    expect(frameSilhouette({ geoShape: "blob" })!.d).toBe((GEO_SHAPES.blob as { d: string }).d);
  });

  it("the rectangle and unknown shapes give null", () => {
    expect(frameSilhouette({ geoShape: "rectangle" })).toBeNull();
    expect(frameSilhouette({ geoShape: "trapecio" })).toBeNull();
    expect(frameSilhouette({})).toBeNull();
  });
});

describe("the svgPath schema", () => {
  const accepts = (svgPath: string) => styleSchema.safeParse({ svgPath }).success;

  it("rejects markup, quotes and url()", () => {
    expect(accepts("M0 0<script>")).toBe(false);
    expect(accepts("url(x)")).toBe(false);
    expect(accepts('M0 0"')).toBe(false);
  });

  it("accepts a normal path", () => {
    expect(accepts("M 10,10 L 90 90 Z")).toBe(true);
  });
});

describe("usesFrameShapes: when a .oim requires frame_shapes", () => {
  it("a new shape with a photo requires it", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "cloud", fillType: "image" })).toBe(true);
  });

  it("an svgPath with a photo requires it", () => {
    expect(usesFrameShapes({ type: "geo", svgPath: "M0 0Z", fillType: "image" })).toBe(true);
  });

  it("flipping the photo requires it", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "star", fillType: "image", fillImageFlipX: true })).toBe(true);
  });

  it("a star without flipping does not require it", () => {
    expect(usesFrameShapes({ type: "geo", geoShape: "star", fillType: "image" })).toBe(false);
  });
});

describe("frameSilhouette rejects anything that is not path data", () => {
  it("drops a markup svgPath, a bad viewBox and a bad customBlobPath", () => {
    expect(frameSilhouette({ svgPath: 'M0 0"/><script>' })).toBeNull();
    expect(frameSilhouette({ svgPath: "M0 0Z", svgViewBox: '0 0 1 1" onload="x' })!.viewBox).toBe("0 0 100 100");
    expect(frameSilhouette({ geoShape: "blob", customBlobPath: "url(x)" })!.d).not.toContain("url");
  });
});
