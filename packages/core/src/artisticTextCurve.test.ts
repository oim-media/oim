/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * La curva del texto artistico, ahora en un solo sitio.
 *
 * Las cifras de aqui son las que el editor venia dibujando. Si alguien
 * «mejora» la curva, esta prueba dice que acaba de cambiar el aspecto de las
 * obras ya guardadas — que es justo la conversacion que hay que tener antes,
 * no despues.
 */

import { describe, it, expect } from "vitest";
import { calculateTextCurvePath, artisticTextLines } from "./artisticTextCurve.js";

describe("calculateTextCurvePath", () => {
  it("con curvatura 0 devuelve una recta por el centro", () => {
    expect(calculateTextCurvePath(360, 120, 0)).toBe("M 0 60 L 360 60");
    expect(calculateTextCurvePath(360, 120, 0, "wave")).toBe("M 0 60 L 360 60");
  });

  // Los valores por defecto de un cartel nuevo: 360x120, curva 15, arco.
  it("el arco por defecto mantiene el texto centrado en la caja", () => {
    // deltaY = 15/100 * 120*0.45 = 8.1
    // extremos en 60 + 4.05, control en 60 - 8.1
    expect(calculateTextCurvePath(360, 120, 15, "arc")).toBe(
      "M 0 64.05 Q 180 51.9 360 64.05"
    );
  });

  it("la onda oscila simetrica alrededor del centro", () => {
    expect(calculateTextCurvePath(360, 120, 15, "wave")).toBe(
      "M 0 60 C 90 51.9, 270 68.1, 360 60"
    );
  });

  it("`arch` se trata como arco, que es lo que el editor ya hacia", () => {
    expect(calculateTextCurvePath(360, 120, 15, "arch")).toBe(
      calculateTextCurvePath(360, 120, 15, "arc")
    );
  });

  it("por omision el tipo es arco", () => {
    expect(calculateTextCurvePath(360, 120, 40)).toBe(
      calculateTextCurvePath(360, 120, 40, "arc")
    );
  });

  it("una curvatura negativa invierte el arco", () => {
    const arriba = calculateTextCurvePath(360, 120, 50, "arc");
    const abajo = calculateTextCurvePath(360, 120, -50, "arc");
    expect(arriba).not.toBe(abajo);
    // deltaY = ±27: control en 60∓27, extremos en 60±13.5
    expect(arriba).toBe("M 0 73.5 Q 180 33 360 73.5");
    expect(abajo).toBe("M 0 46.5 Q 180 87 360 46.5");
  });

  it("la curvatura se acota a ±100", () => {
    expect(calculateTextCurvePath(360, 120, 500)).toBe(
      calculateTextCurvePath(360, 120, 100)
    );
    expect(calculateTextCurvePath(360, 120, -500)).toBe(
      calculateTextCurvePath(360, 120, -100)
    );
  });

  // Esta es la razon de haber elegido la geometria del editor. Se mide el
  // vertice a partir del trazado DEVUELTO, no de la formula, y se compara con
  // el que producia el player.
  it("ni con la curvatura al maximo el trazado se sale de la caja", () => {
    const ALTO = 120;
    const d = calculateTextCurvePath(360, ALTO, 100, "arc");

    // `M 0 y0 Q cx cy 360 y1` -> el vertice de una Bezier cuadratica esta en
    // (P0 + 2*P1 + P2) / 4.
    const m = d.match(/^M 0 (\S+) Q \S+ (\S+) \S+ (\S+)$/);
    expect(m).not.toBeNull();
    const [y0, cy, y1] = m!.slice(1).map(Number);
    const vertice = (y0 + 2 * cy + y1) / 4;

    expect(vertice).toBeGreaterThanOrEqual(0);
    expect(vertice).toBeLessThanOrEqual(ALTO);

    // Lo que devolvia el player: extremos en la linea base y el control a
    // `sagitta * 1.8`. Su vertice se salia por arriba de una caja de 120.
    const sagitta = ALTO * 0.45;
    const verticePlayer = (ALTO / 2 + 2 * (ALTO / 2 - sagitta * 1.8) + ALTO / 2) / 4;
    expect(verticePlayer).toBeLessThan(vertice);
  });
});

describe("artisticTextLines", () => {
  /**
   * El `<text>` de SVG no parte lineas: un "\n" se pinta como un espacio. Por
   * eso pulsar Enter en el texto 3D no hacia nada. Cada linea se dibuja por
   * separado a `offset` px del centro, y el editor y el player tienen que
   * apilarlas igual: por eso vive aqui y no en cada uno.
   */
  it("una sola linea queda en el centro", () => {
    expect(artisticTextLines("HOLA", 40, 1.25)).toEqual([{ text: "HOLA", offset: 0 }]);
  });

  it("dos lineas quedan repartidas alrededor del centro", () => {
    expect(artisticTextLines("UNO\nDOS", 40, 1.25)).toEqual([
      { text: "UNO", offset: -25 },
      { text: "DOS", offset: 25 },
    ]);
  });

  it("con tres lineas la del medio queda en el centro", () => {
    expect(artisticTextLines("A\nB\nC", 40, 1).map((l) => l.offset)).toEqual([-40, 0, 40]);
  });

  it("una linea vacia conserva su hueco", () => {
    expect(artisticTextLines("A\n\nC", 10, 1).map((l) => l.text)).toEqual(["A", "", "C"]);
  });

  it("acepta los saltos de linea de Windows", () => {
    expect(artisticTextLines("A\r\nB", 10, 1).map((l) => l.text)).toEqual(["A", "B"]);
  });
});
