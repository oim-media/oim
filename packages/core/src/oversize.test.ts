/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED, and CANONICAL TABLE. It is copied as-is into the editor: the same
 * cases and the same numbers run on both sides. Having the table travel with
 * the module is what prevents a copy from being adjusted "just a little".
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
    // d = 18. For x it takes 18 over 800 -> 1.045; for y, 18 over 150 ->
    // 1.24. The larger one wins: a single factor, or the layer gets distorted.
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
    // d = 15, anchored to the left: 15 over 200 -> 1 + 30/200
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
    // It overhangs by 50 on each side and only moves 15: that already covers it with room to spare.
    esperado: 1,
  },
  {
    nombre: "una capa diminuta en la esquina se acota en vez de deformarse",
    caja: { left: 0, top: 0, width: 20, height: 20 },
    depth: 1,
    // It would ask for 1 + 60/20 = 4. Enlarging a layer four times does not fix it.
    esperado: MAX_SCALE,
  },
  {
    nombre: "una capa CASI pegada tambien cuenta, no solo la que toca",
    caja: { left: 5, top: 250, width: 200, height: 100 },
    depth: 0.5,
    // d = 15 and the margin is 5, less than d: it is anchored. It takes 15 + 5 =
    // 20 so that not even at the worst displacement is the background visible.
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
    // And enlarging it would do harm: each piece would look bigger than drawn,
    // and the number of pieces was calculated for the unscaled size.
    expect(oversizeScale(horizonte, LIENZO, 0.6, "both", true)).toBe(1);
  });

  it("por defecto se asume que NO hay pista", () => {
    // The parameter is the last and optional one: whoever does not pass it
    // behaves as before. If the default were `true`, adding a new call would
    // disable the oversizing without anyone noticing.
    expect(oversizeScale(horizonte, LIENZO, 0.6, "both")).toBe(1.24);
  });
});

describe("el desplazamiento maximo", () => {
  it("es 30 por la profundidad, no 60", () => {
    // The controller's comment says "Max +- 60px scaled by depth" and it is
    // false: the normalized mouse is bounded to [-0.5, +0.5].
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
