/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Decision (14 Nov): a zone is a 2.0 group without its flow. Its layers keep their
// own x/y (1.x flowed them and ignored it) and the zone paints its box from 2.0.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(edit: (zone: any) => void = () => {}) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 1000, natural_height: 500 },
    zones: [{ id: "z", position: [10, 20], size: [50, 40], style: { display: "flex", background: "#111111" } }],
    slots: [{ id: "in", type: "geo", zone_id: "z", position: [0, 0], width_px: 100, height_px: 50, style: {} }],
  };
  edit(v2LayersOf(engine.metadata).get("z")!);
  await engine.renderSlots();
  return shadow as ShadowRoot;
}

describe("a zone comes from its 2.0 group", () => {
  it("holds its layer, placed absolutely, not in a flow", async () => {
    const shadow = await render();
    const layer = shadow.querySelector('#oim-zone-z [data-slot-id="in"]') as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.style.position).toBe("absolute");
  });

  it("paints its box from the group", async () => {
    const shadow = await render((z) => { z.box = { ...z.box, x: 333 }; });
    expect((shadow.querySelector("#oim-zone-z .oim-zone-box") as HTMLElement).style.left).toBe("333px");
  });
});
