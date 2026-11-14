/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, strokes: a layer's outline is painted from its first 2.0 stroke
// with no `align`, not from the 1.x `stroke*` fields.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(geoShape: string, edit: (stroke: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "s", type: "geo", position: [10, 10], width_px: 100, height_px: 100, content: { es: "" },
      style: { geoShape, fillColor: "#ffffff", strokeColor: "#ff0000", strokeWidth: 2 } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old stroke would show.
  edit(v2LayersOf(engine.metadata).get("s")!.strokes![0]);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="s"]') as HTMLElement;
}

describe("strokes come from the 2.0 layer", () => {
  it("a rectangle's border", async () => {
    const el = await render("rectangle", (s) => { s.paint.value = "#00ff00"; s.width = 5; s.style = "dashed"; });
    expect(el.style.getPropertyValue("border")).toBe("5px dashed #00ff00");
  });

  it("a drawn shape's figure", async () => {
    const el = await render("star", (s) => { s.paint.value = "#00ff00"; s.width = 5; });
    const figure = el.querySelector("[stroke]")!;
    expect(figure.getAttribute("stroke")).toBe("#00ff00");
    expect(figure.getAttribute("stroke-width")).toBe("5");
  });
});
