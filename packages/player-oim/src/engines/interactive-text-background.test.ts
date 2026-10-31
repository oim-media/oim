/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Un text interactivo no se pinta un fondo con el color de su propia letra.
 *
 * El comentario de `ImageEngine.ts` ya dice lo que debe pasar: «For text,
 * lottie, and image slots, the editor stores a highlight/selection color that
 * must NOT be rendered». La condicion de debajo lo incumplia, porque
 * `isGeoLike` se traga la interactividad:
 *
 * ```
 * const isInteractiveSlot = slot.isInteractive === true || … || Boolean(slot.states);
 * const isGeoLike = 'geo' | 'shape' | 'draw' | 'filter' | 'container' | … || isInteractiveSlot;
 * if (style.fillColor && isGeoLike && !isWindowMask) el.style.backgroundColor = style.fillColor;
 * ```
 *
 * En una capa de text `fillColor` ES el color de la letra —lo dice el propio
 * editor al crearla—, asi que el slot quedaba pintado del mismo color que su
 * text: un bloque liso, con la letra dentro e invisible.
 *
 * **Como se encontro.** Exportando un .oim real el 28 de agosto: un boton rojo
 * que en el editor era text rojo sobre blanco, y en el player un rectangulo
 * rojo. El text estaba en el DOM —`textContent` lo confirmaba— con
 * `color` y `background-color` identicos.
 *
 * **Es anterior al enganche del clic.** `isInteractiveSlot` cuenta tambien
 * `Boolean(slot.states)`, asi que cualquier text con estado hover ya salia
 * asi. Con los colores por defecto del editor seria letra oscura sobre fondo
 * oscuro: igual de invisible, y mas dificil de notar.
 *
 * `isGeoLike` mezcla dos preguntas: «se pinta fondo?» y «necesita caja con
 * medidas?». Los interactivos entraron por la segunda y se llevaron la
 * primera de propina. Estas pruebas fijan las dos por separado.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  // `mode="full"` es OBLIGATORIO aqui desde que el defecto pasó a ser la
  // imagen quieta: sin el, ningun slot es interactivo y estas pruebas -que van
  // justamente de slots interactivos- pasarian sin comprobar nada.
  host.setAttribute("mode", "full");
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

async function slotDe(slot: any): Promise<HTMLElement> {
  const { host, motor } = montar([slot]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="s"]') as HTMLElement;
}

const ROJO = "#b91c1c";

// Medidas copiadas de un .oim real —el boton de `prueba_clic_y_esquinas`,
// exportado el 28 de agosto—. Importa que sean las de verdad: la caja del slot
// se calcula desde `style.width`/`height` en `cqw`, que es lo que emite el
// backend, y NO desde `width_px`, que es lo que el editor envia. Un fixture con
// `width_px` deja el ancho vacio y cualquier prueba sobre la caja mediria humo.
const text = (extra: any = {}) => ({
  id: "s", type: "text", align: "center",
  position: [7.5, 53.3333],
  content: { es: "PULSAME" },
  style: {
    width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw",
    fillColor: ROJO, color: ROJO, ...extra,
  },
});

const forma = (extra: any = {}) => ({
  id: "s", type: "geo", align: "center",
  position: [7.5, 7.5],
  content: { es: "" },
  style: { width: "32.5cqw", height: "8.75cqw", fillColor: ROJO, ...extra },
});

const ACCION = { states: { active: { actions: [{ target: "otra", type: "toggle" }] } } };

describe("el fondo de un text interactivo", () => {
  it("un text marcado interactivo NO se pinta el fondo", async () => {
    const el = await slotDe(text({ isInteractive: true }));
    expect(el.style.backgroundColor).toBe("");
  });

  /**
   * El camino que ya existia antes del clic: basta que traiga `states` para
   * que `isInteractiveSlot` lo cuente, sin `isInteractive` de por medio.
   */
  it("y uno con states tampoco, aunque nadie lo marcara", async () => {
    const el = await slotDe(text(ACCION));
    expect(el.style.backgroundColor).toBe("");
  });

  it("el text sigue estando, y con SU color", async () => {
    const el = await slotDe(text({ isInteractive: true }));
    expect(el.textContent).toContain("PULSAME");
    // Lo que hacia el text invisible no era perderlo: era igualar los dos.
    expect(el.style.backgroundColor).not.toBe(el.style.color);
  });

  it("un text normal tampoco lo tenia, y sigue sin tenerlo", async () => {
    const el = await slotDe(text());
    expect(el.style.backgroundColor).toBe("");
  });
});

describe("lo que el arreglo NO puede llevarse por delante", () => {
  it("una FORMA interactiva conserva su fill", async () => {
    // Aqui `fillColor` si es el fill de la figura: quitarlo a todos los
    // interactivos habria cambiado un fallo por otro.
    const el = await slotDe(forma({ isInteractive: true, ...ACCION }));
    expect(el.style.backgroundColor).toBeTruthy();
  });

  it("una forma normal tambien", async () => {
    const el = await slotDe(forma());
    expect(el.style.backgroundColor).toBeTruthy();
  });

  /**
   * Un slot pulsable necesita area, o no hay donde pulsar. Lo garantiza
   * `applyMinHitArea` —WCAG 2.5.8, 24x24— y se dispara por `isInteractiveSlot`,
   * la misma bandera que el arreglo toca. Se comprueba que siga puesta.
   *
   * Se mide el minimo y no el ancho: el ancho sale de `style.width` por otra
   * rama que este banco no ejercita, asi que afirmar sobre el seria medir humo.
   */
  it("un text interactivo conserva su area minima de contacto", async () => {
    const el = await slotDe(text({ isInteractive: true }));
    expect(el.style.minWidth).toBe("24px");
    expect(el.style.minHeight).toBe("24px");
  });

  it("y uno NO interactivo no la lleva: es de los pulsables, no de todos", async () => {
    const el = await slotDe(text());
    expect(el.style.minWidth).toBe("");
  });
});
