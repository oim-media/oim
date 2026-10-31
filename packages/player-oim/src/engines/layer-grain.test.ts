/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Per-layer grain (contract 1.10.0): the slot references the core's grain
// filter, placed in the player's own defs, after its blur and before its shadow.

import { describe, it, expect, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

function engineWith(slots: unknown[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 } as any;
  return { motor, shadow };
}

const text = (style: Record<string, unknown>, type = "text") => ({
  id: "t 1", type, content: { es: "Hola" }, position: [50, 50], style: { fontSize: 24, ...style },
});

afterEach(() => { document.body.innerHTML = ""; });

describe("layer grain in the player", () => {
  it("defines the core filter and references it from the slot", async () => {
    const { motor, shadow } = engineWith([text({ grain: true, grainIntensity: 30, grainSize: 100, grainBlend: "multiply" })]);
    await motor.renderSlots();
    const filter = shadow.querySelector("filter#oim-grain-t_1");
    expect(filter).toBeTruthy();
    expect(filter!.outerHTML).toContain('mode="multiply"');
    expect(filter!.outerHTML).toContain('baseFrequency="0.2"');
    const slot = shadow.querySelector('[data-slot-id="t 1"]') as HTMLElement;
    expect(slot.style.filter).toContain("url(#oim-grain-t_1)");
  });

  it("goes after the layer blur and before the drop shadow", async () => {
    const { motor, shadow } = engineWith([text({ grain: true, blur: 2, shadowEnabled: true }, "geo")]);
    await motor.renderSlots();
    const f = (shadow.querySelector('[data-slot-id="t 1"]') as HTMLElement).style.filter;
    const iBlur = f.indexOf("blur(");
    const iGrain = f.indexOf("url(#oim-grain");
    const iShadow = f.indexOf("drop-shadow(");
    expect(iBlur).toBeGreaterThanOrEqual(0);
    expect(iGrain).toBeGreaterThan(iBlur);
    expect(iShadow).toBeGreaterThan(iGrain);
  });

  it("nothing without grain, and nothing on a type that does not take it", async () => {
    const { motor, shadow } = engineWith([text({}), { ...text({ grain: true }, "lottie"), id: "l" }]);
    await motor.renderSlots();
    expect(shadow.querySelector("filter[id^='oim-grain-']")).toBeNull();
  });
});
