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

function montar(slots: any[], lang: string = "es") {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor.lang = lang;
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

describe("ImageEngine — artistic-text rendering", () => {
  it("renderiza un nodo SVG interactivo con capas de extrusión 3D", async () => {
    const slot = {
      id: "art1",
      type: "artistic-text",
      width_px: 380,
      height_px: 120,
      position: [10, 10],
      content: { es: "HOLA 3D", en: "HELLO 3D" },
      style: {
        fontFamily: "Bangers",
        fontSize: 48,
        extrusionDepth: 12,
        extrusionAngle: 45,
        extrusionColor: "#111827",
        extrusionShading: true,
        fillColor: "#FBBF24",
        outerStrokeColor: "#000000",
        outerStrokeWidth: 4,
        innerStrokeColor: "#FFFFFF",
        innerStrokeWidth: 1,
      },
    };

    const { host, motor } = montar([slot], "es");
    await motor.renderSlots();

    const slotEl = host.shadowRoot!.querySelector('[data-slot-id="art1"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const svgEl = slotEl.querySelector("svg");
    expect(svgEl).not.toBeNull();

    // Comprobar que contiene elementos <text> correspondientes a la extrusión y cara frontal
    const textEls = svgEl!.querySelectorAll("text");
    expect(textEls.length).toBeGreaterThanOrEqual(12); // 12 capas de extrusión + cara frontal

    // Comprobar contenido en español
    expect(svgEl!.textContent).toContain("HOLA 3D");
  });

  it("renderiza texto curvado en arco con textPath", async () => {
    const slot = {
      id: "art2",
      type: "artistic-text",
      width_px: 400,
      height_px: 140,
      position: [20, 20],
      content: { es: "CURVADO" },
      style: {
        fontFamily: "Righteous",
        fontSize: 50,
        curveAmount: 25,
        curveType: "arc",
        extrusionDepth: 6,
        fillColor: "#FF0055",
      },
    };

    const { host, motor } = montar([slot], "es");
    await motor.renderSlots();

    const slotEl = host.shadowRoot!.querySelector('[data-slot-id="art2"]') as HTMLElement;
    const pathEl = slotEl.querySelector("defs path");
    expect(pathEl).not.toBeNull();

    const textPathEls = slotEl.querySelectorAll("textPath");
    expect(textPathEls.length).toBeGreaterThan(0);
    expect(textPathEls[0].textContent).toContain("CURVADO");
  });

  it("actualiza el texto y SVG reactivamente al cambiar de idioma con setLang", async () => {
    const slot = {
      id: "art3",
      type: "artistic-text",
      width_px: 360,
      height_px: 110,
      position: [15, 15],
      content: { es: "¡EXPLOSIÓN!", en: "BOOM!" },
      style: {
        fontFamily: "Bangers",
        fontSize: 52,
        extrusionDepth: 10,
        fillColor: "#FBBF24",
      },
    };

    const { host, motor } = montar([slot], "es");
    await motor.renderSlots();

    let slotEl = host.shadowRoot!.querySelector('[data-slot-id="art3"]') as HTMLElement;
    expect(slotEl.textContent).toContain("¡EXPLOSIÓN!");

    // Conmutar idioma a inglés (el cambio ocurre con transición de desenfoque a los 180ms)
    motor.setLang("en");
    await new Promise((r) => setTimeout(r, 250));

    slotEl = host.shadowRoot!.querySelector('[data-slot-id="art3"]') as HTMLElement;
    expect(slotEl.textContent).toContain("BOOM!");
  });
});
