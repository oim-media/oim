/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * View modes: what a .oim does depending on where it is placed.
 *
 * The same file serves two very different places —a grid with twenty
 * thumbnails, and an enlarged view where only it is— and it must not behave
 * the same in both. The one who knows is the PAGE, not the player: the player
 * cannot see beyond itself, so it cannot deduce that there are more files in view.
 *
 * Before this, the landing already built the modes by hand and halfway:
 * `ShowcasePage.tsx` passed `disable-animations="true"` in the gallery and
 * `BlogPage.tsx` passed nothing. One axis of the two, copied by hand, without a name.
 *
 * **The factory default changes.** Before, a bare `<oim-player src>` moved
 * -and it also ran clicks-. Now it inherits the minimum: a still image with
 * its language. A default is not a preference, it is what whoever reads nothing
 * carries away, and it is the only part of an API that cannot be changed later
 * without breaking someone. It changes today because today it is free.
 *
 * `mode` is a preset of the TWO flags, and an explicit attribute overrides it.
 * That is why a third "custom" mode is not needed: it is simply not setting `mode`.
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

/** `prefers-reduced-motion: reduce` active. */
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

  /** A mode that does not exist cannot turn anything on: it falls back to the default. */
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

  /** Without `mode`: the loose attributes still apply. That is the «custom» one. */
  it("y sin mode ninguno, los atributos solos bastan", () => {
    const m = motorCon({ "disable-actions": "false" });
    expect(m.disableActions).toBe(false);
    expect(m.disableAnimations).toBe(true);
  });
});

describe("prefers-reduced-motion", () => {
  /**
   * It is a VESTIBULAR preference: it protects against motion sickness. Whoever
   * turns it on still wants to click. Switching off its actions takes away
   * FUNCTION, not motion — that would be an accessibility regression disguised
   * as deference.
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
  // `OimPlayer.mount()` is the viewer's route, which brings its own controls.
  it("una opcion explicita pisa el mode", () => {
    const m = motorCon({ mode: "image" }, { disableAnimations: false, disableActions: false });
    expect(m.disableAnimations).toBe(false);
    expect(m.disableActions).toBe(false);
  });
});

/**
 * That the mode is NOTICED in the DOM, not only in the flag.
 *
 * A flag that nobody checks is worse than not having it: the integrator declares
 * `mode="image"`, feels reassured, and the file keeps responding.
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
    // If something were hooked up, the click would fire the action and touch the DOM.
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
   * The old click path (`interaction.toggle_elements`) is another door to the
   * same place. Gating one and leaving the other open would be worse than not
   * gating: it would deem something safe that is not.
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
   * The console's actionEvent exists for the case "the file asks for it and the
   * player does not know". In image mode the player DOES know and has decided
   * not to do it: warning would send someone looking for a failure that does
   * not exist, and in a gallery of twenty, twenty times.
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
