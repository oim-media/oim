/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que el interlineado deje de tener cuatro opiniones.
 *
 * El caso que de verdad muerde es la CADENA: los `.oim` publicados traen
 * `lineHeight: "1.2"`, no `1.2`. Una comprobacion que solo aceptara numeros
 * pasaria en verde mientras todos los archivos reales caen al valor por
 * defecto sin que nada lo diga.
 */

import { describe, it, expect } from "vitest";
import {
  resolveLineHeight,
  DEFAULT_LINE_HEIGHT,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
  inkMargin,
  MAX_FONT_HEIGHT,
} from "./typography";

describe("resolveLineHeight", () => {
  it("lee el numero", () => {
    expect(resolveLineHeight({ lineHeight: 1.6 })).toBe(1.6);
  });

  /** Lo que traen los .oim publicados, medido sobre tres de ellos. */
  it("lee la cadena numerica, que es lo que hay en los archivos reales", () => {
    expect(resolveLineHeight({ lineHeight: "1.2" })).toBe(1.2);
  });

  it("sin interlineado devuelve el mismo valor que pinta el editor", () => {
    expect(resolveLineHeight({})).toBe(DEFAULT_LINE_HEIGHT);
    expect(resolveLineHeight(undefined)).toBe(DEFAULT_LINE_HEIGHT);
    expect(resolveLineHeight(null)).toBe(DEFAULT_LINE_HEIGHT);
  });

  it.each([0, -1, "0", "-2", "", "   ", "alto", NaN, Infinity, {}, []])(
    "vuelve al valor por defecto ante %p",
    (v) => {
      expect(resolveLineHeight({ lineHeight: v })).toBe(DEFAULT_LINE_HEIGHT);
    },
  );

  /**
   * `<input type="number" min max>` no impide teclear fuera de rango: el
   * atributo solo bloquea el envio de un formulario, y en el editor no hay
   * ninguno. Un archivo puede traer 99, y 99 lineas de alto por linea es un
   * texto que tapa el resto del documento.
   */
  it("acota a los limites que ofrece el editor", () => {
    expect(resolveLineHeight({ lineHeight: 99 })).toBe(MAX_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: 0.1 })).toBe(MIN_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: "500" })).toBe(MAX_LINE_HEIGHT);
  });

  it("los extremos del rango pasan tal cual", () => {
    expect(resolveLineHeight({ lineHeight: MIN_LINE_HEIGHT })).toBe(MIN_LINE_HEIGHT);
    expect(resolveLineHeight({ lineHeight: MAX_LINE_HEIGHT })).toBe(MAX_LINE_HEIGHT);
  });

  /**
   * El valor por defecto tiene que caer dentro del rango o el editor y el
   * player discreparian justo en el caso mas comun: el de la capa que no dice
   * nada.
   */
  it("el valor por defecto esta dentro del rango", () => {
    expect(DEFAULT_LINE_HEIGHT).toBeGreaterThanOrEqual(MIN_LINE_HEIGHT);
    expect(DEFAULT_LINE_HEIGHT).toBeLessThanOrEqual(MAX_LINE_HEIGHT);
  });
});

describe("inkMargin", () => {
  /**
   * El caso de hoy: interlineado 1.2, que es lo que traen los .oim reales.
   * Poppins declara 1.396 em de alto, asi que sobresale 0.196 -0.098 por
   * lado-. Sin ese margen, la «j» y la «p» pierden el relleno por abajo.
   */
  it("con el interlineado de los archivos reales, deja margen", () => {
    expect(inkMargin(1.2)).toBeCloseTo(0.1, 3);
  });

  it("cuanto mas apretado, mas margen hace falta", () => {
    expect(inkMargin(1.0)).toBeGreaterThan(inkMargin(1.2));
    expect(inkMargin(0.8)).toBeGreaterThan(inkMargin(1.0));
  });

  /**
   * La mitad que suele olvidarse. Un margen fijo agrandaria el area de fondo
   * siempre, y un degradado VERTICAL se reparte sobre ella: sus colores se
   * moverian aunque no hubiera nada que compensar.
   */
  it("con un interlineado holgado NO anade nada", () => {
    expect(inkMargin(1.4)).toBe(0);
    expect(inkMargin(1.5)).toBe(0);
    expect(inkMargin(3)).toBe(0);
  });

  it("el limite exacto no anade margen", () => {
    expect(inkMargin(MAX_FONT_HEIGHT)).toBe(0);
  });

  it("un valor imposible cae al interlineado por defecto", () => {
    expect(inkMargin(0)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
    expect(inkMargin(NaN)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
    expect(inkMargin(-1)).toBe(inkMargin(DEFAULT_LINE_HEIGHT));
  });

  /**
   * La constante sale de una medicion, no de una intuicion: es el alto de
   * Poppins, la mayor de las seis fuentes que se midieron. Si bajara, la
   * fuente que mas sobresale volveria a cortarse.
   */
  it("el alto maximo cubre a Poppins, que es la peor medida", () => {
    expect(MAX_FONT_HEIGHT).toBeGreaterThanOrEqual(1.396);
  });
});
