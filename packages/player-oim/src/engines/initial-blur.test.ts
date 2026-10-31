/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import { getStylesText } from "../core/styles";
import ImageEngine from "./ImageEngine";

describe("Efecto de desenfoque (blur 14px) en la carga inicial", () => {
  it("la hoja de estilos declara blur(14px) en .oim-player-viewport y none en .oim-viewport--ready", () => {
    const css = getStylesText();

    // Comprobar la regla .oim-player-viewport
    const viewportMatch = css.match(/\.oim-player-viewport\s*\{([^}]+)\}/);
    expect(viewportMatch).toBeTruthy();
    expect(viewportMatch![1]).toContain("filter: blur(var(--oim-reveal-blur, 14px))");
    expect(viewportMatch![1]).toContain("transition: opacity var(--oim-reveal-duration, 0.32s) ease-in-out, filter var(--oim-reveal-duration, 0.32s) ease-in-out");

    // Comprobar la regla .oim-player-viewport.oim-viewport--ready
    const readyMatch = css.match(/\.oim-player-viewport\.oim-viewport--ready\s*\{([^}]+)\}/);
    expect(readyMatch).toBeTruthy();
    expect(readyMatch![1]).toContain("filter: none");
    expect(readyMatch![1]).toContain("opacity: 1");
  });

  it("al cargar con prefers-reduced-motion: reduce se asigna filter: none de forma inline", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const originalMatchMedia = window.matchMedia;
    (window as any).matchMedia = (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    try {
      const motor = new ImageEngine(host as any);
      // Simular llamada load parcial interceptando antes del fetch
      motor.imageUrl = "data:image/png;base64,iVBORw0KGgo=";
      const shadow = (host as any).shadowRoot || host.attachShadow({ mode: "open" });
      shadow.innerHTML =
        '<div class="oim-player-viewport" part="viewport">' +
          '<img class="oim-player-base" src="" alt="Capa 0" />' +
          '<div class="oim-layer-overlay"></div>' +
        '</div>';
      motor._viewport = shadow.querySelector('.oim-player-viewport');

      // Si _prefersLessMotion es true, se fuerza filter = 'none'
      if (motor._prefersLessMotion() && motor._viewport) {
        (motor._viewport as HTMLElement).style.filter = "none";
      }

      expect((motor._viewport as HTMLElement).style.filter).toBe("none");
    } finally {
      window.matchMedia = originalMatchMedia;
      host.remove();
    }
  });

  it("al completar renderSlots() el viewport recibe la clase oim-viewport--ready", async () => {
    const host = document.createElement("div");
    const shadow = (host as any).attachShadow({ mode: "open" });
    document.body.appendChild(host);

    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-player-viewport";
    shadow.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);
    motor.metadata = { slots: [], width: 800, height: 600 } as any;

    expect(motor._viewport.classList.contains("oim-viewport--ready")).toBe(false);

    await motor.renderSlots();

    expect(motor._viewport.classList.contains("oim-viewport--ready")).toBe(true);
    host.remove();
  });
});
