/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TABLA COMPARTIDA, y CANONICA. Se copy tal cual al editor: los mismos casos
 * y los mismos numeros corren en los dos lados. Que la tabla viaje con el
 * modulo es lo que impide que una copy se ajuste "solo un poco".
 */

import { describe, it, expect } from "vitest";
import {
  maxOffset,
  oversizeScale,
  MAX_SCALE,
  type ParallaxAxis,
} from "./oversize";

const LIENZO = { width: 800, height: 600 };

interface Caso {
  nombre: string;
  caja: { left: number; top: number; width: number; height: number };
  depth: number;
  eje?: ParallaxAxis;
  esperado: number;
}

const CASOS: Caso[] = [
  {
    nombre: "una capa en mitad del lienzo no se toca",
    caja: { left: 300, top: 200, width: 200, height: 200 },
    depth: 0.5,
    esperado: 1,
  },
  {
    nombre: "el horizonte, que llega de lado a lado y toca el suelo",
    caja: { left: 0, top: 450, width: 800, height: 150 },
    depth: 0.6,
    // d = 18. Por x hace falta 18 sobre 800 -> 1.045; por y, 18 sobre 150 ->
    // 1.24. Manda el mayor: un factor unico, o la capa se deforma.
    esperado: 1.24,
  },
  {
    nombre: "la luna, suelta arriba a la derecha, no necesita nada",
    caja: { left: 600, top: 60, width: 100, height: 100 },
    depth: 0.2,
    esperado: 1,
  },
  {
    nombre: "una capa que solo se mueve en vertical ignora el borde lateral",
    caja: { left: 0, top: 250, width: 200, height: 100 },
    depth: 0.5,
    eje: "y_only",
    esperado: 1,
  },
  {
    nombre: "...pero la misma capa con eje libre si lo corrige",
    caja: { left: 0, top: 250, width: 200, height: 100 },
    depth: 0.5,
    eje: "both",
    // d = 15, pegada a la izquierda: 15 sobre 200 -> 1 + 30/200
    esperado: 1.15,
  },
  {
    nombre: "sin profundidad no hay movimiento y no hay nada que cubrir",
    caja: { left: 0, top: 0, width: 800, height: 600 },
    depth: 0,
    esperado: 1,
  },
  {
    nombre: "una capa que YA sobresale del lienzo se deja en paz",
    caja: { left: -50, top: 200, width: 900, height: 200 },
    depth: 0.5,
    // Sobresale 50 por cada lado y solo se mueve 15: ya cubre de sobra.
    esperado: 1,
  },
  {
    nombre: "una capa diminuta en la esquina se acota en vez de deformarse",
    caja: { left: 0, top: 0, width: 20, height: 20 },
    depth: 1,
    // Pediria 1 + 60/20 = 4. Agrandar una capa cuatro veces no la arregla.
    esperado: MAX_SCALE,
  },
  {
    nombre: "una capa CASI pegada tambien cuenta, no solo la que toca",
    caja: { left: 5, top: 250, width: 200, height: 100 },
    depth: 0.5,
    // d = 15 y el margen es 5, menor que d: esta anclada. Hace falta 15 + 5 =
    // 20 para que ni en el peor desplazamiento se vea el fondo.
    esperado: 1.2,
  },
];

describe("la escala de sobredimensionado del parallax", () => {
  for (const c of CASOS) {
    it(c.nombre, () => {
      expect(oversizeScale(LIENZO && c.caja, LIENZO, c.depth, c.eje)).toBe(c.esperado);
    });
  }
});

describe("una capa con pista de bucle infinito no se toca", () => {
  const horizonte = { left: 0, top: 450, width: 800, height: 150 };

  it("sin pista, el horizonte se agranda", () => {
    expect(oversizeScale(horizonte, LIENZO, 0.6, "both", false)).toBe(1.24);
  });

  it("con pista, NO: la pista ya cubre el lienzo toda la vuelta", () => {
    // Y agrandarla haria daño: cada pieza se veria mas grande de lo dibujado,
    // y el numero de piezas se calculo para el tamaño sin escalar.
    expect(oversizeScale(horizonte, LIENZO, 0.6, "both", true)).toBe(1);
  });

  it("por defecto se asume que NO hay pista", () => {
    // El parametro es el ultimo y opcional: quien no lo pase se comporta como
    // antes. Si el defecto fuera `true`, añadir una llamada nueva desactivaria
    // el sobredimensionado sin que nadie lo notara.
    expect(oversizeScale(horizonte, LIENZO, 0.6, "both")).toBe(1.24);
  });
});

describe("el desplazamiento maximo", () => {
  it("es 30 por la profundidad, no 60", () => {
    // El comentario del controlador dice "Max +- 60px scaled by depth" y es
    // falso: el raton normalizado esta acotado a [-0.5, +0.5].
    expect(maxOffset(1)).toBe(30);
    expect(maxOffset(0.5)).toBe(15);
  });

  it("una profundidad negativa mueve lo mismo, hacia el otro lado", () => {
    expect(maxOffset(-0.5)).toBe(15);
  });

  it("un valor sin sentido no rompe nada", () => {
    expect(maxOffset(NaN)).toBe(0);
  });
});
