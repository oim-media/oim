/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A layer's texture goes on its own pixels: the overlay is masked with the
// layer's SVG (Josué, 10 Oct 2026: a transparent SVG came out as a square).
import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slot: any) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.lang = "es";
  motor.metadata = { width: 800, height: 600, slots: [{ id: "s", align: "center", position: [10, 10], width_px: 120, height_px: 120, ...slot }] };
  return { motor, shadow };
}

const TEX = { type: "texture", preset: "film-grain-35mm", intensity: 100, blend: "overlay", color: "#06B6D4", enabled: true };

describe("layer texture on the layer's pixels", () => {
  it("an SVG layer's texture overlay is masked with its SVG", async () => {
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0h10"/></svg>';
    const { motor, shadow } = mount({ type: "svg", content: { es: svg }, style: { effects: [TEX] } });
    await motor.renderSlots();
    const ov = shadow.querySelector(".oim-effect-texture") as HTMLElement;
    expect(ov).not.toBeNull();
    const mask = ov.style.maskImage || (ov.style as any).webkitMaskImage;
    expect(mask).toContain("data:image/svg+xml");
  });
});
