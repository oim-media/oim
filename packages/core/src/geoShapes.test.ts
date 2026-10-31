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

describe("la tabla cubre TODO el catalogo", () => {
  it("ninguna forma se queda sin dibujo", () => {
    // Without this, the player knew 3 of 8 and the other 5 were published as
    // coloured rectangles. Silently: nothing would detect it.
    const sinDibujo = CATALOGO
      .filter((f) => f !== "rectangle")
      .filter((f) => !shapeDrawing(f));
    expect(sinDibujo).toEqual([]);
  });

  it("el rectangulo NO esta en la tabla, y es a proposito", () => {
    // It is drawn with width, height and radius in real pixels: a corner radius
    // inside a stretched viewBox comes out oval.
    expect(shapeDrawing("rectangle")).toBeUndefined();
    expect(shapeDrawing("rect")).toBeUndefined();
  });

  it("una forma desconocida devuelve undefined, no una por defecto", () => {
    expect(shapeDrawing("trapecio")).toBeUndefined();
    expect(shapeDrawing(undefined)).toBeUndefined();
  });
});

describe("la geometria, numero a numero", () => {
  it("el triangulo va metido un 5%, no a sangre", () => {
    // The player drew it as `50,0 0,100 100,100` and the editor as `50,5 95,90 5,90`:
    // the same file, two different triangles.
    expect(shapeDrawing("triangle")).toEqual({
      tipo: "polygon",
      puntos: [[50, 5], [95, 90], [5, 90]],
    });
  });

  it("la estrella tiene diez puntos y el primero es 50,2", () => {
    const d = shapeDrawing("star")!;
    expect(d.tipo).toBe("polygon");
    expect((d as any).puntos).toHaveLength(10);
    expect((d as any).puntos[0]).toEqual([50, 2]);
  });

  it("el circulo es un arco de radio 45, no un poligono", () => {
    const d = shapeDrawing("circle")!;
    expect(d.tipo).toBe("path");
    expect((d as any).d).toContain("A 45,45");
  });

  it("la linea y el garabato son los unicos trazos sin relleno", () => {
    const abiertas = Object.entries(GEO_SHAPES)
      .filter(([, d]) => d.tipo === "path" && !(d as any).rellenable)
      .map(([n]) => n)
      .sort();
    expect(abiertas).toEqual(["line", "scribble"]);
  });

  it("todos los poligonos caben en el viewBox", () => {
    for (const [nombre, d] of Object.entries(GEO_SHAPES)) {
      if (d.tipo !== "polygon") continue;
      for (const [x, y] of d.puntos) {
        expect(x, `${nombre} se sale por x`).toBeGreaterThanOrEqual(0);
        expect(x, `${nombre} se sale por x`).toBeLessThanOrEqual(100);
        expect(y, `${nombre} se sale por y`).toBeGreaterThanOrEqual(0);
        expect(y, `${nombre} se sale por y`).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("pointsToAttribute", () => {
  it("produce el atributo `points` de SVG", () => {
    expect(pointsToAttribute([[50, 5], [95, 90]])).toBe("50,5 95,90");
  });
});
