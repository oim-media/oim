/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemela de OIM-Studio/src/lib/trimPath.test.ts.
 *
 * Los dos repos no comparten paquete, así que la función está duplicada a
 * propósito — y por eso la prueba también. Es el guardián de paridad: si una
 * de las dos implementaciones cambia sin la otra, esta prueba lo detecta antes
 * de que un `.oim` se vea distinto en el visor que en el editor.
 *
 * No es una precaución teórica: el editor y el visor implementaron por
 * separado la misma onda senoidal y salieron en direcciones opuestas. Las 224
 * pruebas pasaron porque coincidían en el primer carácter, y solo lo detectó
 * una revisión cruzada a mano.
 *
 * Los valores esperados son EXACTAMENTE los del editor. Si aquí hay que
 * cambiar uno, el cambio va en las dos partes o hay una divergencia.
 */

import { describe, it, expect } from "vitest";
import { getTrimCss } from "./trimPath";

/** El visor lee `style` del .oim, no un `Shape`, así que el molde es estructural. */
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
 * Espejo de "getTrimCss con animacion de dibujado" en
 * OIM-Studio/src/lib/trimPath.test.ts. Mismos valores esperados.
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
