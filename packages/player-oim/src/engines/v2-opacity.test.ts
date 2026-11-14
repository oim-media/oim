/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, opacity and visibility: both come from the 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(slot: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots: [{ id: "a", type: "geo", position: [10, 10], content: { es: "" }, ...slot }] };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old value would show.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="a"]') as HTMLElement;
}

describe("opacity and visibility paint from the 2.0 layer", () => {
  it("its opacity", async () => {
    const el = await render({ style: { width: 10, height: 10, opacity: 20 } }, (l) => { l.opacity = 0.6; });
    expect(el.dataset.oimOpacity).toBe("0.6");
  });

  it("a layer hidden in 2.0 is hidden", async () => {
    const el = await render({ style: { width: 10, height: 10 } }, (l) => { l.visible = false; });
    expect(el.style.display).toBe("none");
  });

  it("a layer shown in 2.0 is shown, whatever 1.x said", async () => {
    const el = await render({ isVisible: false, style: { width: 10, height: 10, isVisible: false } }, (l) => { delete l.visible; });
    expect(el.style.display).not.toBe("none");
  });
});
