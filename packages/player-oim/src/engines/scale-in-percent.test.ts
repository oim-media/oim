/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from "vitest";
import { escalaComoFactor, stateStyles } from "./states";

describe("la escala de un estado interactivo viaja en porcentaje", () => {
  it("103 agranda un 3%, no ciento tres veces", () => {
    // The real failure, measured on published works:
    // the value was passed as-is to a CSS that multiplies.
    expect(escalaComoFactor(103)).toBeCloseTo(1.03);
    expect(stateStyles({ scale: 103 })["--oim-slot-hover-scale"]).toBe("1.03");
  });

  it("los cinco valores que existen en archivos reales quedan cerca de 1", () => {
    for (const medido of [96, 97, 103, 105, 106]) {
      const factor = escalaComoFactor(medido);
      expect(factor).toBeGreaterThan(0.9);
      expect(factor).toBeLessThan(1.1);
    }
  });

  it("100 es el tamano natural", () => {
    expect(escalaComoFactor(100)).toBe(1);
  });

  describe("el puente para los multiplicadores que el contrato permitia", () => {
    it("un 1.1 de los de antes sigue siendo un 10% mas, no un 1%", () => {
      // Without the bridge, dividing by 100 would shrink it to 0.011: the layer would
      // vanish when the mouse went over it. No file like that exists, but the contract
      // allowed them and the arithmetic does not tell them apart on its own.
      expect(escalaComoFactor(1.1)).toBe(1.1);
      expect(escalaComoFactor(1.5)).toBe(1.5);
    });

    it("el corte esta en 10, que era el tope del contrato viejo", () => {
      expect(escalaComoFactor(10)).toBe(10);
      expect(escalaComoFactor(11)).toBeCloseTo(0.11);
    });
  });

  it("opacity sigue en porcentaje, que ya lo estaba", () => {
    // The pair that gave the bug away: same unit, same object, and only one of the
    // two was divided.
    expect(stateStyles({ opacity: 50 }).opacity).toBe("0.5");
  });
});
