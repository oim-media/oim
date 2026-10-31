/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paridad del easing por keyframe entre el editor y el visor.
 *
 * El editor compila la curva en `compile.ts` (`toEasing`) y la mete en el
 * campo `e` de cada keyframe del `.oim`. El visor la lee aquí y se la pasa a
 * WAAPI. Si una de las dos partes cambia sin la otra, la animación se ve
 * distinta en el visor que en el editor — y nada avisa, porque el archivo es
 * válido y no hay error en consola.
 *
 * Ya ocurrió con la onda senoidal: editor y visor la implementaron por
 * separado y salieron en direcciones opuestas. Las 224 pruebas pasaron porque
 * coincidían en el primer carácter.
 *
 * Los valores de entrada de estas pruebas son EXACTAMENTE los que emite
 * `toEasing` del editor. Si aquí hay que añadir uno, el cambio va en las dos
 * partes o hay una divergencia.
 */

import { describe, it, expect } from "vitest";
import { keyframesToWaapi } from "./ImageEngine";

describe("keyframesToWaapi — easing por keyframe", () => {
  it("pasa hold tal cual: steps(1, end) es CSS valido y WAAPI lo entiende", () => {
    const frames = keyframesToWaapi(
      [
        { t: 0, o: 0, e: "steps(1, end)" },
        { t: 1, o: 1 }
      ],
      1
    );
    expect(frames[0].easing).toBe("steps(1, end)");
  });

  it("conserva las cuatro curvas nombradas", () => {
    for (const curva of ["linear", "ease-in", "ease-out", "ease-in-out"]) {
      const frames = keyframesToWaapi([{ t: 0, o: 0, e: curva }], 1);
      expect(frames[0].easing).toBe(curva);
    }
  });

  it("convierte la bezier de cuatro numeros a cubic-bezier()", () => {
    const frames = keyframesToWaapi([{ t: 0, o: 0, e: [0.4, 0, 0.2, 1] }], 1);
    expect(frames[0].easing).toBe("cubic-bezier(0.4,0,0.2,1)");
  });

  it("no pone easing cuando el keyframe no trae ninguno", () => {
    const frames = keyframesToWaapi([{ t: 0, o: 0 }], 1);
    expect(frames[0].easing).toBeUndefined();
  });

  it("el offset se normaliza al rango [0,1] segun la duracion", () => {
    const frames = keyframesToWaapi(
      [
        { t: 0, o: 0 },
        { t: 2, o: 1 },
        { t: 8, o: 0 }
      ],
      4
    );
    expect(frames[0].offset).toBe(0);
    expect(frames[1].offset).toBe(0.5);
    // Un keyframe mas alla de la duracion se recorta en 1, no se sale.
    expect(frames[2].offset).toBe(1);
  });
});
