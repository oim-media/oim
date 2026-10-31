/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * El orden importa mas que las reglas.
 *
 * Un grupo de parallax de texto existe -una cinta de titulares en bucle-, y si
 * el texto ganara, el bucle dejaria de recortarse y se veria la pista entera.
 * Esa combinacion es la que decide el orden de las tres reglas, y la que una
 * prueba por regla no habria tocado.
 */

import { describe, it, expect } from "vitest";
import { slotClipping } from "./clipping";

const slot = (p: Partial<Parameters<typeof slotClipping>[0]> = {}) => ({
  isText: false, isParallaxGroup: false, hasFilterOrShadow: false, ...p,
});

describe("slotClipping", () => {
  it("un texto no se recorta: la tinta que sobresale de la caja de linea es suya", () => {
    expect(slotClipping(slot({ isText: true }))).toBe("visible");
  });

  it("una capa cualquiera si se recorta", () => {
    expect(slotClipping(slot())).toBe("hidden");
  });

  it("con sombra o filtro no se recorta: se pintan fuera de la caja", () => {
    expect(slotClipping(slot({ hasFilterOrShadow: true }))).toBe("visible");
  });

  /**
   * La combinacion que decide el orden. Sin esto, poner la regla del texto
   * antes que la del parallax pasaba en verde y rompia el bucle en produccion.
   */
  it("un grupo de parallax DE TEXTO sigue recortando", () => {
    expect(slotClipping(slot({ isText: true, isParallaxGroup: true }))).toBe("hidden");
  });

  it("un grupo de parallax con sombra tambien sigue recortando", () => {
    expect(slotClipping(slot({ hasFilterOrShadow: true, isParallaxGroup: true }))).toBe("hidden");
  });

  it("un texto con sombra no se recorta por partida doble", () => {
    expect(slotClipping(slot({ isText: true, hasFilterOrShadow: true }))).toBe("visible");
  });
});
