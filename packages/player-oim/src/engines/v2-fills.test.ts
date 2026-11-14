/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, fills: a gradient, pattern or generative fill is painted from the
// layer's 2.0 `fills`, not from the 1.x `fill*` fields.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(style: object) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas_width: 800,
    canvas_height: 600,
    slots: [{ id: "s", type: "geo", position: [0.1, 0.1], width_px: 100, height_px: 100, content: { es: "" }, style: { geoShape: "rectangle", ...style } }],
  };
  return { engine, shadow };
}

describe("fills come from the 2.0 layer", () => {
  it("the fill layer paints the 2.0 gradient", async () => {
    const { engine, shadow } = await render({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" });
    // Change the 2.0 layer only: if the renderer still read 1.x, the old colours would show.
    const fill = v2LayersOf(engine.metadata).get("s")!.fills![0] as any;
    fill.gradient.stops[0].color = "#00ff00";
    await engine.renderSlots();
    const layer = shadow.querySelector(".oim-fill-layer") as HTMLElement;
    expect(layer.style.backgroundImage).toContain("#00ff00");
  });

  it("a container paints its 2.0 fill too", async () => {
    const { engine, shadow } = await render({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" });
    engine.metadata.slots[0].type = "container";
    const fill = v2LayersOf(engine.metadata).get("s")!.fills![0] as any;
    fill.gradient.stops[0].color = "#00ff00";
    await engine.renderSlots();
    const el = shadow.querySelector('[data-slot-id="s"]') as HTMLElement;
    expect(el.style.backgroundImage).toContain("#00ff00");
  });

  it("a gradient keeps painting as 1.x did when nothing changed", async () => {
    const { engine, shadow } = await render({ fillType: "gradient", fillGradient: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" });
    await engine.renderSlots();
    const layer = shadow.querySelector(".oim-fill-layer") as HTMLElement;
    expect(layer.style.backgroundImage).toMatch(/linear-gradient\(90deg, #ff0000 0%, #0000ff 100%\)/);
  });
});
