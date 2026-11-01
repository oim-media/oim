/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED and CANONICAL TABLE. It is copied as-is to the editor: the same cases
 * run on both sides. The table travelling with the module is what prevents
 * a copy from "adjusting" its numbers a little, which is how we got here.
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES, shapeDrawing, pointsToAttribute } from "./geoShapes";

/**
 * The editor's catalogue, by hand. It is the list of buttons under "Shapes and
 * geometric" in the presets library.
 *
 * Written by hand and not imported because this file ALSO runs in the player, which
 * cannot see the editor's catalogue. The comparison against the real catalogue is made by
 * a local test in the editor; this one pins the number so that adding a shape to the
 * catalogue without adding it to the table does not go unnoticed.
 */
const CATALOGO = [
  "rectangle", "circle", "triangle", "star",
  "line", "arrow", "hexagon", "diamond", "heart",
];

describe("the table covers ALL of the catalog", () => {
  it("no shape is left without a drawing", () => {
    // Without this, the player knew 3 of 8 and the other 5 were published as
    // coloured rectangles. Silently: nothing would detect it.
    const sinDibujo = CATALOGO
      .filter((f) => f !== "rectangle")
      .filter((f) => !shapeDrawing(f));
    expect(sinDibujo).toEqual([]);
  });

  it("the rectangle is NOT in the table, on purpose", () => {
    // It is drawn with width, height and radius in real pixels: a corner radius
    // inside a stretched viewBox comes out oval.
    expect(shapeDrawing("rectangle")).toBeUndefined();
    expect(shapeDrawing("rect")).toBeUndefined();
  });

  it("an unknown shape returns undefined, not a default", () => {
    expect(shapeDrawing("trapecio")).toBeUndefined();
    expect(shapeDrawing(undefined)).toBeUndefined();
  });
});

describe("the geometry, number by number", () => {
  it("the triangle is inset by 5%, not run to the edge", () => {
    // The player drew it as `50,0 0,100 100,100` and the editor as `50,5 95,90 5,90`:
    // the same file, two different triangles.
    expect(shapeDrawing("triangle")).toEqual({
      kind: "polygon",
      points: [[50, 5], [95, 90], [5, 90]],
    });
  });

  it("the star has ten points and the first is 50,2", () => {
    const d = shapeDrawing("star")!;
    expect(d.kind).toBe("polygon");
    expect((d as any).points).toHaveLength(10);
    expect((d as any).points[0]).toEqual([50, 2]);
  });

  it("the circle is an arc of radius 45, not a polygon", () => {
    const d = shapeDrawing("circle")!;
    expect(d.kind).toBe("path");
    expect((d as any).d).toContain("A 45,45");
  });

  it("the line and the scribble are the only strokes without fill", () => {
    const abiertas = Object.entries(GEO_SHAPES)
      .filter(([, d]) => d.kind === "path" && !(d as any).fillable)
      .map(([n]) => n)
      .sort();
    expect(abiertas).toEqual(["line", "scribble"]);
  });

  it("all polygons fit in the viewBox", () => {
    for (const [name, d] of Object.entries(GEO_SHAPES)) {
      if (d.kind !== "polygon") continue;
      for (const [x, y] of d.points) {
        expect(x, `${name} overflows on x`).toBeGreaterThanOrEqual(0);
        expect(x, `${name} overflows on x`).toBeLessThanOrEqual(100);
        expect(y, `${name} overflows on y`).toBeGreaterThanOrEqual(0);
        expect(y, `${name} overflows on y`).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("pointsToAttribute", () => {
  it("produces the SVG `points` attribute", () => {
    expect(pointsToAttribute([[50, 5], [95, 90]])).toBe("50,5 95,90");
  });
});
