/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { resolveDimensionToCss, resolveNumericDimension } from "./dimensions";

describe("dimensions - resolución de unidades hacia ViewBox y CSS", () => {
  it("conserva cadenas CSS legacy con cqw intactas", () => {
    expect(resolveDimensionToCss("32.5cqw", 1000)).toBe("32.5cqw");
    expect(resolveDimensionToCss("100%", 1000)).toBe("100%");
    expect(resolveDimensionToCss("24px", 1000)).toBe("24px");
  });

  it("convierte numeros puros de usuario a cqw relativo al canvas", () => {
    // 250 on a 1000 canvas = 25cqw
    expect(resolveDimensionToCss(250, 1000)).toBe("25cqw");
    expect(resolveDimensionToCss(400, 800)).toBe("50cqw");
  });

  it("maneja strings numericos puros sin unidad convirtiendolos a cqw", () => {
    expect(resolveDimensionToCss("250", 1000)).toBe("25cqw");
  });

  it("devuelve fallback si el valor es nulo o indefinido", () => {
    expect(resolveDimensionToCss(undefined, 1000, "10cqw")).toBe("10cqw");
    expect(resolveDimensionToCss(null, 1000, "auto")).toBe("auto");
    expect(resolveDimensionToCss("", 1000, "none")).toBe("none");
  });

  it("resolveNumericDimension extrae pixeles absolutos a partir de cqw o %", () => {
    expect(resolveNumericDimension("25cqw", 1000)).toBe(250);
    expect(resolveNumericDimension("50%", 800)).toBe(400);
    expect(resolveNumericDimension(350, 1000)).toBe(350);
    expect(resolveNumericDimension("120px", 1000)).toBe(120);
    expect(resolveNumericDimension(undefined, 1000)).toBeNull();
  });
});
