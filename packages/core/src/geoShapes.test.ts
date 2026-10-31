/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TABLA COMPARTIDA, y CANONICA. Se copy tal cual al editor: los mismos casos
 * corren en los dos lados. Que la tabla viaje con el modulo es lo que impide
 * que una copy "ajuste un poco" sus numeros, que es como llegamos aqui.
 */

import { describe, it, expect } from "vitest";
import { GEO_SHAPES, shapeDrawing, pointsToAttribute } from "./geoShapes";

/**
 * El catalogo del editor, a mano. Es la lista de botones de «Formas y
 * geometricos» en la biblioteca de presets.
 *
 * A mano y no importada porque este archivo corre TAMBIEN en el player, que no
 * ve el catalogo del editor. La comparacion contra el catalogo de verdad la
 * hace una prueba local del editor; esta fija el numero para que anadir una
 * forma al catalogo sin anadirla a la tabla no pase inadvertido.
 */
const CATALOGO = [
  "rectangle", "circle", "triangle", "star",
  "line", "arrow", "hexagon", "diamond", "heart",
];

describe("la tabla cubre TODO el catalogo", () => {
  it("ninguna forma se queda sin dibujo", () => {
    // Sin esto, el player conocia 3 de 8 y las otras 5 se publicaban como
    // rectangulos de color. En silencio: no habia nada que lo detectara.
    const sinDibujo = CATALOGO
      .filter((f) => f !== "rectangle")
      .filter((f) => !shapeDrawing(f));
    expect(sinDibujo).toEqual([]);
  });

  it("el rectangulo NO esta en la tabla, y es a proposito", () => {
    // Se dibuja con ancho, alto y radio en pixeles reales: un radio de esquina
    // dentro de un viewBox estirado sale ovalado.
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
    // El player lo dibujaba `50,0 0,100 100,100` y el editor `50,5 95,90 5,90`:
    // el mismo archivo, dos triangulos distintos.
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
