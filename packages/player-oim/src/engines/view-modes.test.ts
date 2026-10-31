/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Los modos de vista: que hace un .oim segun donde lo pongan.
 *
 * El mismo archivo vale para dos sitios muy distintos —una rejilla con veinte
 * miniaturas y una vista ampliada donde solo esta el— y no debe comportarse
 * igual en los dos. Quien lo sabe es la PAGINA, no el player: no ve fuera de
 * si mismo, asi que no puede deducir que hay mas archivos a la vista.
 *
 * Antes de esto la landing ya se fabricaba los modos a mano y a medias:
 * `ShowcasePage.tsx` pasaba `disable-animations="true"` en la galeria y
 * `BlogPage.tsx` no pasaba nada. Un eje de los dos, copiado a mano, sin nombre.
 *
 * **El defecto de fabrica cambia.** Antes un `<oim-player src>` pelado se movia
 * -y desde el 28 de agosto tambien ejecutaba clics-. Ahora hereda lo minimo:
 * imagen quieta con su idioma. Un defecto no es una preferencia, es lo que se
 * lleva quien no lee nada, y es la unica parte de una API que no se puede
 * cambiar despues sin romper a alguien. Se cambia hoy porque hoy es gratis.
 *
 * `mode` es un preajuste de las DOS banderas, y un atributo explicito manda
 * sobre el. Por eso no hace falta un tercer mode «personalizado»: es
 * simplemente no poner `mode`.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

function motorCon(attrs: Record<string, string> = {}, options: any = {}) {
  const host = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
  (host as any).attachShadow({ mode: "open" });
  return new ImageEngine(host as any, options) as any;
}

afterEach(() => vi.unstubAllGlobals());

/** `prefers-reduced-motion: reduce` activo. */
function conMovimientoReducido() {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.indexOf("prefers-reduced-motion") >= 0,
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe("el defecto de fabrica: una imagen quieta", () => {
  it("sin atributos, ni se mueve ni responde", () => {
    const m = motorCon();
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });
});

describe('mode="full"', () => {
  it("enciende las dos cosas", () => {
    const m = motorCon({ mode: "full" });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(false);
  });

  it('y "image" las deja apagadas, igual que el defecto', () => {
    const m = motorCon({ mode: "image" });
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });

  /** Un mode que no existe no puede encender nada: se cae al defecto. */
  it("un mode desconocido no enciende nada", () => {
    const m = motorCon({ mode: "galeria-turbo" });
    expect(m.disableAnimations).toBe(true);
    expect(m.disableActions).toBe(true);
  });
});

describe("un atributo explicito manda sobre el mode", () => {
  it("completo + disable-actions apaga SOLO las acciones", () => {
    const m = motorCon({ mode: "full", "disable-actions": "true" });
    expect(m.disableActions).toBe(true);
    expect(m.disableAnimations).toBe(false);
  });

  it("imagen + disable-animations=false enciende SOLO el movimiento", () => {
    const m = motorCon({ mode: "image", "disable-animations": "false" });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(true);
  });

  /** Sin `mode`: los atributos sueltos siguen valiendo. Eso es el «personalizado». */
  it("y sin mode ninguno, los atributos solos bastan", () => {
    const m = motorCon({ "disable-actions": "false" });
    expect(m.disableActions).toBe(false);
    expect(m.disableAnimations).toBe(true);
  });
});

describe("prefers-reduced-motion", () => {
  /**
   * Es una preferencia VESTIBULAR: protege de mareos por movimiento. Quien la
   * activa sigue queriendo pulsar. Apagarle las acciones le quita FUNCION, no
   * movimiento — seria una regresion de accesibilidad disfrazada de deferencia.
   */
  it("apaga el movimiento aunque el mode sea completo", () => {
    conMovimientoReducido();
    expect(motorCon({ mode: "full" }).disableAnimations).toBe(true);
  });

  it("pero NO toca las acciones", () => {
    conMovimientoReducido();
    expect(motorCon({ mode: "full" }).disableActions).toBe(false);
  });
});

describe("las opciones de mount ganan a todo", () => {
  // `OimPlayer.mount()` es la via del visor, que trae sus propios controles.
  it("una opcion explicita pisa el mode", () => {
    const m = motorCon({ mode: "image" }, { disableAnimations: false, disableActions: false });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(false);
  });
});

/**
 * Que el mode se NOTE en el DOM, no solo en la bandera.
 *
 * Una bandera que nadie consulta es peor que no tenerla: el integrador declara
 * `mode="image"`, se queda tranquilo, y el archivo sigue respondiendo.
 */
describe("el mode llega al slot", () => {
  function montar(slots: any[], attrs: Record<string, string> = {}) {
    const host = document.createElement("div");
    for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
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

  const boton = (extra: any = {}) => ({
    id: "b", type: "text", align: "center", position: [10, 10],
    content: { es: "PULSAME" },
    style: {
      width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw",
      fillColor: "#b91c1c", color: "#b91c1c", isInteractive: true,
      states: { active: { actions: [{ target: "otra", type: "toggle" }] } },
      ...extra,
    },
  });

  async function slotEn(attrs: Record<string, string>, slot: any = boton()) {
    const { host, motor } = montar([slot], attrs);
    await motor.renderSlots();
    return host.shadowRoot!.querySelector('[data-slot-id="b"]') as HTMLElement;
  }

  it('en mode imagen no se señala como pulsable', async () => {
    expect((await slotEn({ mode: "image" })).style.cursor).not.toBe("pointer");
  });

  it("y un clic no ejecuta nada", async () => {
    const el = await slotEn({ mode: "image" });
    const otra = document.createElement("div");
    // Si algo se enganchara, el clic lanzaria la accion y tocaria el DOM.
    const antes = el.outerHTML;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    expect(el.outerHTML).toBe(antes);
    otra.remove();
  });

  it("tampoco reserva el area minima de contacto: nada es pulsable", async () => {
    expect((await slotEn({ mode: "image" })).style.minWidth).toBe("");
  });

  it("en mode completo si se señala y si reserva area", async () => {
    const el = await slotEn({ mode: "full" });
    expect(el.style.cursor).toBe("pointer");
    expect(el.style.minWidth).toBe("24px");
  });

  /**
   * El camino viejo del clic (`interaction.toggle_elements`) es otra puerta al
   * mismo sitio. Gatear una y dejar la otra abierta seria peor que no gatear:
   * daria por seguro algo que no lo es.
   */
  it("el camino viejo del clic tambien queda cerrado", async () => {
    const conInteraction = {
      id: "b", type: "geo", align: "center", position: [10, 10],
      content: { es: "" },
      style: { width: "32.5cqw", height: "8.75cqw", fillColor: "#b91c1c" },
      interaction: { action_type: "toggle_elements", target: { show_slots: ["otra"] } },
    };
    expect((await slotEn({ mode: "image" }, conInteraction)).style.cursor).not.toBe("pointer");
  });

  /**
   * El actionEvent de consola existe para el caso «el archivo lo pide y el player no
   * sabe». En mode imagen el player SI sabe y ha decidido no hacerlo: avisar
   * mandaria a buscar un fallo que no hay, y en una galeria de veinte, veinte
   * veces.
   */
  it("y no avisa por consola de algo que se apago a proposito", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await slotEn({ mode: "image" }, boton({ states: undefined }));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
