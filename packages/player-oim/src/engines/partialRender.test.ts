/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor = new ImageEngine(host as any);
  motor._overlay = document.createElement("div");
  motor._overlay.className = "oim-layer-overlay";
  shadow.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 } as any;
  return { host, motor };
}

const dosCapas = () => ([
  { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: {} },
  { id: "pie", type: "text", content: { es: "Igual", en: "Igual" }, position: [50, 80], style: {} },
]);

describe("renderSlots parcial", () => {
  let host: HTMLElement, motor: any;
  beforeEach(async () => {
    ({ host, motor } = montar(dosCapas()));
    await motor.renderSlots();
  });

  it("sin opciones reconstruye todo, como siempre", async () => {
    const antes = host.shadowRoot!.querySelector('[data-slot-id="pie"]');
    await motor.renderSlots();
    const despues = host.shadowRoot!.querySelector('[data-slot-id="pie"]');
    expect(despues).not.toBe(antes);
  });

  it("con onlyIds NO toca los nodos de las demas capas", async () => {
    const pieAntes = host.shadowRoot!.querySelector('[data-slot-id="pie"]');
    const tituloAntes = host.shadowRoot!.querySelector('[data-slot-id="titulo"]');

    await motor.renderSlots({ onlyIds: new Set(["titulo"]) });

    // The SAME node, not an equivalent one: that is what keeps animations and parallax.
    expect(host.shadowRoot!.querySelector('[data-slot-id="pie"]')).toBe(pieAntes);
    expect(host.shadowRoot!.querySelector('[data-slot-id="titulo"]')).not.toBe(tituloAntes);
  });

  it("la capa reconstruida queda en su sitio del apilado", async () => {
    await motor.renderSlots({ onlyIds: new Set(["titulo"]) });
    const ids = Array.from(host.shadowRoot!.querySelectorAll("[data-slot-id]"))
      .map((el) => el.getAttribute("data-slot-id"));
    expect(ids).toEqual(["titulo", "pie"]);
  });

  it("con mascaras se reconstruye todo aunque pidas una sola capa", async () => {
    const { host: h2, motor: m2 } = montar([
      ...dosCapas(),
      { id: "mascara", type: "mask", content: {}, position: [50, 50], style: { maskMode: "cutout" } },
    ]);
    await m2.renderSlots();
    const pieAntes = h2.shadowRoot!.querySelector('[data-slot-id="pie"]');
    await m2.renderSlots({ onlyIds: new Set(["titulo"]) });
    // The composition is computed over the whole stack: a node cannot be patched.
    expect(h2.shadowRoot!.querySelector('[data-slot-id="pie"]')).not.toBe(pieAntes);
  });
});

describe("el controlador de parallax sobrevive al render parcial", () => {
  const conParallax = () => ([
    { id: "titulo", type: "text", content: { es: "Hola", en: "Hello" }, position: [50, 20], style: {},
      parallax: { enabled: true, depth: 0.5, mode: "mouse", axis: "both" } },
    { id: "pie", type: "text", content: { es: "Igual", en: "Igual" }, position: [50, 80], style: {} },
  ]);

  it("reapunta la capa reconstruida al nodo nuevo", async () => {
    // Without this the controller would keep moving the old node, already detached,
    // and the new layer would stay still without anything giving it away.
    const { host, motor } = montar(conParallax());
    await motor.renderSlots();

    const ctrl: any = motor._parallaxController;
    expect(ctrl).toBeTruthy();

    await motor.renderSlots({ onlyIds: new Set(["titulo"]) });

    const nuevo = host.shadowRoot!.querySelector('[data-slot-id="titulo"]');
    const item = ctrl.items.find((i: any) => i.id === "titulo");
    expect(item.element).toBe(nuevo);
    expect(item.element.isConnected).toBe(true);
  });

  it("un render completo destruye el controlador anterior", async () => {
    // Each render created a new one and left the old one running: a mousemove
    // listener and an rAF loop, forever.
    const { motor } = montar(conParallax());
    await motor.renderSlots();

    const primero: any = motor._parallaxController;
    let destruido = 0;
    const originalDestroy = primero.destroy.bind(primero);
    primero.destroy = () => { destruido++; originalDestroy(); };

    await motor.renderSlots();

    expect(destruido).toBe(1);
    expect(motor._parallaxController).not.toBe(primero);
  });
});
