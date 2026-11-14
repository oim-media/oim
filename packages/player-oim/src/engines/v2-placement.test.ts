/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A sized layer is pinned at the point 1.x pinned it (by its alignment) inside
// the 2.0 box: the painted element is not always exactly the box, and pinning
// it by the corner moved centred text by a few pixels (vector `palettes`).
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";

async function place(slot: object) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots: [{ id: "t", type: "text", content: { es: "Paleta" }, ...slot }] };
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="t"]') as HTMLElement;
}

describe("a sized layer is pinned by its alignment inside the 2.0 box", () => {
  it("centred: at the box's centre, moved back half its own width", async () => {
    const el = await place({ position: [10, 33.3333], align: "center", width_px: 640, height_px: 120, style: { width: "80cqw", height: "15cqw" } });
    expect(parseFloat(el.style.left)).toBeCloseTo(400.00, 1);
    expect(parseFloat(el.style.top)).toBeCloseTo(260.00, 1);
    expect(el.style.getPropertyValue("--oim-tx")).toBe("-50%");
  });

  it("left: at the box's left edge", async () => {
    const el = await place({ position: [10, 10], width_px: 200, height_px: 50, style: { width: "25cqw", height: "6.25cqw", textAlign: "left" } });
    expect(parseFloat(el.style.left)).toBeCloseTo(80.00, 1);
    expect(el.style.getPropertyValue("--oim-tx")).toBe("0%");
  });
});
