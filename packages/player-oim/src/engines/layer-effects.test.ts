/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest";
import { ImageEngine } from "./ImageEngine.js";

function engineWith(slots: any[]) {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 } as any;
  return { motor, shadow };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("layer effects in ImageEngine", () => {
  it("renderiza overlay de textura GPU para un slot con efecto texture", async () => {
    const slot = {
      id: "card-1",
      type: "container",
      position: [50, 50],
      size: [30, 20],
      style: {
        effects: [
          {
            type: "texture",
            preset: "film-grain-35mm",
            intensity: 40,
            blend: "overlay",
            scale: 1,
            enabled: true,
          },
        ],
      },
    };

    const { motor, shadow } = engineWith([slot]);
    await motor.renderSlots();
    const slotEl = shadow.querySelector('[data-slot-id="card-1"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const textureOverlay = slotEl.querySelector(".oim-effect-texture") as HTMLElement;
    expect(textureOverlay).not.toBeNull();
    expect(textureOverlay.style.mixBlendMode).toBe("overlay");
    expect(textureOverlay.style.opacity).toBe("0.4");
  });

  it("compone filtros CSS drop-shadow y blur en slotEl.style.filter", async () => {
    const slot = {
      id: "text-1",
      type: "geo",
      position: [50, 50],
      size: [30, 20],
      style: {
        fillColor: "#ff0000",
        effects: [
          {
            type: "blur",
            radius: 6,
            enabled: true,
          },
          {
            type: "drop-shadow",
            blur: 14,
            x: 0,
            y: 8,
            spread: 0,
            color: "rgba(0, 0, 0, 0.4)",
            enabled: true,
          },
        ],
      },
    };

    const { motor, shadow } = engineWith([slot]);
    await motor.renderSlots();
    const slotEl = shadow.querySelector('[data-slot-id="text-1"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.filter).toContain("blur(6px)");
    expect(slotEl.style.filter).toContain("drop-shadow(0px 8px 14px rgba(0, 0, 0, 0.4))");
  });

  it("resuelve colorRole dinámico en efecto drop-shadow", async () => {
    const slot = {
      id: "photo-10",
      type: "container",
      position: [50, 50],
      size: [30, 20],
      style: {
        effects: [
          {
            type: "drop-shadow",
            blur: 0,
            x: 8,
            y: 8,
            color: "#a3e635",
            colorRole: "accent",
            enabled: true,
          },
        ],
      },
    };

    const { motor, shadow } = engineWith([slot]);
    await motor.renderSlots();
    const slotEl = shadow.querySelector('[data-slot-id="photo-10"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    expect(slotEl.style.filter).toContain("drop-shadow(8px 8px 0px var(--oim-color-accent, var(--oim-palette-accent, #a3e635)))");
  });
});
