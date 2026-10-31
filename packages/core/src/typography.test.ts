/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Making sure line height stops having four opinions.
 *
 * The case that really bites is the STRING: published .oim files carry
 * `lineHeight: "1.2"`, not `1.2`. A check that only accepted numbers would
 * pass green while every real file silently falls back to the default value.
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

  /** What published .oim files carry, measured across three of them. */
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
   * `<input type="number" min max>` does not stop typing outside the range: the
   * attribute only blocks submitting a form, and the editor has none. A file can
   * carry 99, and 99 lines of height per line is text that covers the rest of
   * the document.
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
   * The default value must fall within the range, or the editor and the player
   * would disagree in the most common case: the layer that says nothing.
   */
  it("el valor por defecto esta dentro del rango", () => {
    expect(DEFAULT_LINE_HEIGHT).toBeGreaterThanOrEqual(MIN_LINE_HEIGHT);
    expect(DEFAULT_LINE_HEIGHT).toBeLessThanOrEqual(MAX_LINE_HEIGHT);
  });
});

describe("inkMargin", () => {
  /**
   * The case at hand: line height 1.2, which is what real .oim files carry.
   * Poppins declares 1.396 em of height, so it protrudes 0.196 -0.098 per
   * side-. Without that margin, the "j" and the "p" lose their fill at the
   * bottom.
   */
  it("con el interlineado de los archivos reales, deja margen", () => {
    expect(inkMargin(1.2)).toBeCloseTo(0.1, 3);
  });

  it("cuanto mas apretado, mas margen hace falta", () => {
    expect(inkMargin(1.0)).toBeGreaterThan(inkMargin(1.2));
    expect(inkMargin(0.8)).toBeGreaterThan(inkMargin(1.0));
  });

  /**
   * The half that is usually forgotten. A fixed margin would always enlarge the
   * background area, and a VERTICAL gradient is spread over it: its colors would
   * move even when there is nothing to compensate.
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
   * The constant comes from a measurement, not from intuition: it is Poppins'
   * height, the largest of the six fonts measured. If it were lowered, the font
   * that protrudes the most would be cut off again.
   */
  it("el alto maximo cubre a Poppins, que es la peor medida", () => {
    expect(MAX_FONT_HEIGHT).toBeGreaterThanOrEqual(1.396);
  });
});
