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

function motorCon(registros: Array<{ slotId: string; inst: any }>) {
  const host = document.createElement("div");
  (host as any).attachShadow({ mode: "open" });
  const motor = new ImageEngine(host as any);
  motor._lottieInstances = registros as any;
  return motor;
}

describe("_destroyLottiesIn", () => {
  it("destruye solo las capas pedidas y deja vivas las demas", () => {
    // This is the WHOLE reason for this task: rebuilding one layer must not kill
    // the Lottie instances of the rest of the canvas.
    const a = lottieFalso(), b = lottieFalso();
    const motor = motorCon([
      { slotId: "logo", inst: a.inst },
      { slotId: "fondo", inst: b.inst },
    ]);

    motor._destroyLottiesIn(new Set(["logo"]));

    expect(a.estado.destruido).toBe(1);
    expect(b.estado.destruido).toBe(0);
  });

  it("saca de la lista las destruidas, y solo esas", () => {
    // If they stayed in the list, a later destroy() would touch them twice and
    // play()/pause() would keep talking to dead instances.
    const a = lottieFalso(), b = lottieFalso();
    const motor = motorCon([
      { slotId: "logo", inst: a.inst },
      { slotId: "fondo", inst: b.inst },
    ]);

    motor._destroyLottiesIn(new Set(["logo"]));

    expect(motor._lottieInstances.map((r: any) => r.slotId)).toEqual(["fondo"]);
  });

  it("un id que no esta no destruye nada", () => {
    const a = lottieFalso();
    const motor = motorCon([{ slotId: "logo", inst: a.inst }]);

    motor._destroyLottiesIn(new Set(["no-existe"]));

    expect(a.estado.destruido).toBe(0);
    expect(motor._lottieInstances).toHaveLength(1);
  });

  it("si una instancia falla al destruirse, las demas se destruyen igual", () => {
    // lottie-web's destroy() can throw on a node that is already unmounted.
    const rota = { destroy() { throw new Error("nodo desmontado"); } } as any;
    const buena = lottieFalso();
    const motor = motorCon([
      { slotId: "rota", inst: rota },
      { slotId: "buena", inst: buena.inst },
    ]);

    expect(() => motor._destroyLottiesIn(new Set(["rota", "buena"]))).not.toThrow();
    expect(buena.estado.destruido).toBe(1);
    expect(motor._lottieInstances).toHaveLength(0);
  });

  it("play() y pause() siguen alcanzando a las que quedan", () => {
    // The registry changed from the instance to {slotId, inst}: if any loop
    // was not updated, it shows up here.
    let reproducidas = 0;
    const inst = { destroy() {}, play() { reproducidas++; }, pause() {} } as any;
    const motor = motorCon([{ slotId: "vive", inst }]);

    motor.play();

    expect(reproducidas).toBe(1);
  });
});
