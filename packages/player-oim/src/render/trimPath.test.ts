/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Twin of the editor's trimPath tests.
 *
 * The function is duplicated in the editor on purpose, and so is its test:
 * it is the parity guard. If one implementation changes without the other,
 * this catches it before a `.oim` looks different in the player than in the
 * editor.
 *
 * Not a theoretical worry: the editor and the player implemented the same
 * sine wave separately and it came out in opposite directions. 224 tests
 * passed because both agreed on the first character; only a manual
 * cross-review caught it.
 *
 * The expected values are EXACTLY the editor's. Changing one here means
 * changing both, or there is a divergence.
 */

import { describe, it, expect } from "vitest";
import { getTrimCss } from "./trimPath";

/** The viewer reads `style` from the .oim, not a `Shape`, so the mold is structural. */
function makeStyle(overrides: Record<string, unknown>) {
  return { strokeWidth: 2, ...overrides };
}

describe("getTrimCss", () => {
  it("devuelve objeto vacio sin trazo", () => {
    expect(getTrimCss(makeStyle({ strokeWidth: 0, trimEnd: 50 }), 200)).toEqual({});
  });

  it("devuelve objeto vacio cuando el recorte cubre el contorno entero", () => {
    expect(getTrimCss(makeStyle({ trimStart: 0, trimEnd: 100 }), 200)).toEqual({});
  });

  it("calcula dasharray y dashoffset a partir de la longitud", () => {
    const css = getTrimCss(makeStyle({ trimStart: 0, trimEnd: 50 }), 200);
    expect(css.strokeDasharray).toBe("100 200");
    expect(css.strokeDashoffset).toBe(0);
  });

  it("desplaza el inicio del trazo", () => {
    const css = getTrimCss(makeStyle({ trimStart: 25, trimEnd: 75 }), 200);
    expect(css.strokeDasharray).toBe("100 200");
    expect(css.strokeDashoffset).toBe(-50);
  });

  it("longitud cero no produce division por cero", () => {
    expect(getTrimCss(makeStyle({ trimStart: 0, trimEnd: 50 }), 0)).toEqual({});
  });
});

/**
 * Mirrors the editor's "getTrimCss with draw animation" suite. Same values.
 */
describe("getTrimCss con animacion de dibujado", () => {
  it("un contorno completo CON duracion si se anima", () => {
    const css = getTrimCss(makeStyle({ trimStart: 0, trimEnd: 100, trimDuration: 2 }), 200);
    expect(css.animation).toBe("oim-trim-draw 2s ease-out forwards");
    expect(css.strokeDasharray).toBe("200 200");
  });

  it("un contorno completo SIN duracion sigue sin producir nada", () => {
    expect(getTrimCss(makeStyle({ trimStart: 0, trimEnd: 100 }), 200)).toEqual({});
  });

  it("el recorrido va de invisible a la posicion final", () => {
    const css = getTrimCss(makeStyle({ trimStart: 0, trimEnd: 50, trimDuration: 1 }), 200);
    expect(css["--oim-trim-from"]).toBe("100px");
    expect(css["--oim-trim-to"]).toBe("0px");
  });

  it("respeta trimStart en los dos extremos del recorrido", () => {
    const css = getTrimCss(makeStyle({ trimStart: 25, trimEnd: 75, trimDuration: 1 }), 200);
    expect(css["--oim-trim-from"]).toBe("50px");
    expect(css["--oim-trim-to"]).toBe("-50px");
  });

  it("duracion 0 no anima", () => {
    expect(getTrimCss(makeStyle({ trimStart: 0, trimEnd: 50, trimDuration: 0 }), 200).animation).toBeUndefined();
  });

  it("sin trazo no anima aunque haya duracion", () => {
    expect(getTrimCss(makeStyle({ strokeWidth: 0, trimDuration: 2 }), 200)).toEqual({});
  });
});
