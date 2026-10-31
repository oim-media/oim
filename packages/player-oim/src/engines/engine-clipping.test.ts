/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Que la regla llegue al elemento.
 *
 * `recorte.test.ts` fija la decision; esto fija que el motor la escribe, y
 * sobre todo que el grupo de parallax SIGUE recortando: es el unico caso en el
 * que recortar es el efecto, y el que se rompe si alguien reordena las reglas.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

async function recorteDe(slot: any): Promise<string> {
  const { host, motor } = montar([{ id: "s", position: [50, 50], ...slot }]);
  await motor.renderSlots();
  return (host.shadowRoot!.querySelector('[data-slot-id="s"]') as HTMLElement).style.overflow;
}

const text = (extra: any = {}) => ({
  type: "text", align: "left", content: { es: "ejemplo jpg" },
  style: { fontSize: "48px", ...extra },
});

describe("el recorte en el motor", () => {
  /**
   * El fallo medido: con `line-height: 1.2`, Poppins corta 0,70 px de tinta
   * por abajo a 48 px y Playfair Display 0,20. Son las dos fuentes de los
   * .oim reales, y el corte crece con el size.
   */
  it("un text no recorta sus propios glifos", async () => {
    expect(await recorteDe(text())).toBe("visible");
  });

  /**
   * Aqui NO se comprueba «una capa cualquiera recorta»: el motor vuelve a
   * escribir `overflow` mas adelante en otras tres ramas -las de SVG y forma-
   * para que el trazo no se corte, asi que una figura geometrica acaba en
   * `visible` por un camino distinto. Afirmarlo aqui comprobaria esas ramas,
   * no esta regla. `recorte.test.ts` cubre la decision; esto cubre el cable.
   */

  /**
   * Su recorte ES el efecto: la caja es la ventana por la que pasa la pista.
   * Si el text ganara a esta regla, un bucle de titulares mostraria la cinta
   * entera y dejaria de ser un bucle.
   */
  it("un grupo de parallax DE TEXTO sigue recortando", async () => {
    expect(await recorteDe({ ...text(), isParallaxGroup: true })).toBe("hidden");
  });
});
