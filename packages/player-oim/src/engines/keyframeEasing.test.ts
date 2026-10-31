/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parity of the per-keyframe easing between the editor and the viewer.
 *
 * The editor compiles the curve in `compile.ts` (`toEasing`) and puts it in the
 * `e` field of each keyframe in the `.oim`. The viewer reads it here and passes
 * it to WAAPI. If one of the two sides changes without the other, the animation
 * looks different in the viewer than in the editor — and nothing warns, because
 * the file is valid and there is no console error.
 *
 * It already happened with the sine wave: editor and viewer implemented it
 * separately and went in opposite directions. The 224 tests passed because they
 * matched on the first character.
 *
 * The input values in these tests are EXACTLY the ones that the editor's
 * `toEasing` emits. If one has to be added here, the change goes in both sides
 * or there is a divergence.
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
    // A keyframe beyond the duration is clamped to 1, it does not go outside.
    expect(frames[2].offset).toBe(1);
  });
});
