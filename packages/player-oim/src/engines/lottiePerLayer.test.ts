/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

/** A double that records whether destroy() was called on it. */
function lottieFalso() {
  const estado = { destruido: 0 };
  return {
    estado,
    inst: {
      destroy() { estado.destruido++; },
      play() {}, pause() {},
    } as any,
  };
}

function engineWith(registros: Array<{ slotId: string; inst: any }>) {
  const host = document.createElement("div");
  (host as any).attachShadow({ mode: "open" });
  const motor = new ImageEngine(host as any);
  motor._lottieInstances = registros as any;
  return motor;
}

describe("_destroyLottiesIn", () => {
  it("destroys only the requested layers and leaves the rest alive", () => {
    // This is the WHOLE reason for this task: rebuilding one layer must not kill
    // the Lottie instances of the rest of the canvas.
    const a = lottieFalso(), b = lottieFalso();
    const motor = engineWith([
      { slotId: "logo", inst: a.inst },
      { slotId: "fondo", inst: b.inst },
    ]);

    motor._destroyLottiesIn(new Set(["logo"]));

    expect(a.estado.destruido).toBe(1);
    expect(b.estado.destruido).toBe(0);
  });

  it("removes the destroyed ones from the list, and only those", () => {
    // If they stayed in the list, a later destroy() would touch them twice and
    // play()/pause() would keep talking to dead instances.
    const a = lottieFalso(), b = lottieFalso();
    const motor = engineWith([
      { slotId: "logo", inst: a.inst },
      { slotId: "fondo", inst: b.inst },
    ]);

    motor._destroyLottiesIn(new Set(["logo"]));

    expect(motor._lottieInstances.map((r: any) => r.slotId)).toEqual(["fondo"]);
  });

  it("an id that does not exist destroys nothing", () => {
    const a = lottieFalso();
    const motor = engineWith([{ slotId: "logo", inst: a.inst }]);

    motor._destroyLottiesIn(new Set(["no-existe"]));

    expect(a.estado.destruido).toBe(0);
    expect(motor._lottieInstances).toHaveLength(1);
  });

  it("if one instance fails to destroy, the others are destroyed anyway", () => {
    // lottie-web's destroy() can throw on a node that is already unmounted.
    const rota = { destroy() { throw new Error("node desmontado"); } } as any;
    const buena = lottieFalso();
    const motor = engineWith([
      { slotId: "rota", inst: rota },
      { slotId: "buena", inst: buena.inst },
    ]);

    expect(() => motor._destroyLottiesIn(new Set(["rota", "buena"]))).not.toThrow();
    expect(buena.estado.destruido).toBe(1);
    expect(motor._lottieInstances).toHaveLength(0);
  });

  it("play() and pause() still reach the ones that remain", () => {
    // The registry changed from the instance to {slotId, inst}: if any loop
    // was not updated, it shows up here.
    let reproducidas = 0;
    const inst = { destroy() {}, play() { reproducidas++; }, pause() {} } as any;
    const motor = engineWith([{ slotId: "vive", inst }]);

    motor.play();

    expect(reproducidas).toBe(1);
  });
});
