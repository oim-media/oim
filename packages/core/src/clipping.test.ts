/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Order matters more than the rules.
 *
 * A text parallax group exists (a looping headline ribbon), and if the text won,
 * the loop would stop being clipped and the whole track would show.
 * That combination is what decides the order of the three rules, and the one that a
 * test per rule would not have touched.
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
   * The combination that decides the order. Without this, putting the text rule
   * before the parallax one passed in green and broke the loop in production.
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
