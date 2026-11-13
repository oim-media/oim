/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, text: what a text paints comes from its 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "t", type: "text", position: [10, 10], content: { es: "Hola" }, style: { fontSize: "5cqw", ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old paint would show.
  edit(v2LayersOf(engine.metadata).get("t")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="t"]') as HTMLElement;
}

describe("a text paints from its 2.0 layer", () => {
  it("its colour", async () => {
    const el = await render({ fillColor: "#ff0000" }, (l) => { l.fills[0].value = "#00ff00"; });
    expect(el.style.getPropertyValue("color")).toBe("#00ff00");
  });

  it("its gradient, clipped to the glyphs", async () => {
    const el = await render(
      { fillType: "gradient", fillGradient: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" },
      (l) => { l.fills[0].gradient.stops[0].color = "#00ff00"; },
    );
    expect(el.outerHTML).toContain("#00ff00");
    expect(el.outerHTML).not.toContain("#ff0000");
  });
});
