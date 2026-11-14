/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, motion: the endless scroll comes from the 2.0 layer's `motion.loop`.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

const infinite = { enabled: true, mode: "infinite_horizontal", infinite: { enabled: true, speed_px_sec: 35 } };

async function render(slots: any[], edit: (layers: Map<string, any>) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots };
  // Change the 2.0 layers only: if the renderer still read 1.x, the old motion would run.
  edit(v2LayersOf(engine.metadata) as Map<string, any>);
  await engine.renderSlots();
  return { shadow, engine };
}

const geo = (id: string, extra: object = {}) => ({ id, type: "geo", position: [0, 0], content: { es: "" }, style: { width: 50, height: 50 }, ...extra });

describe("a layer loops from its 2.0 layer", () => {
  it("its speed and direction come from motion.loop", async () => {
    const { shadow } = await render([geo("a")], (l) => { l.get("a").motion = { loop: { speedPxSec: 40, direction: "left_to_right" } }; });
    const track = shadow.querySelector('[data-slot-id="a"] .oim-parallax-track') as HTMLElement;
    expect(track.style.getPropertyValue("animation-direction")).toBe("reverse");
  });

  it("no loop in 2.0, nothing scrolls, whatever 1.x said", async () => {
    const { shadow } = await render([geo("a", { parallax: infinite })], (l) => { delete l.get("a").motion; });
    expect(shadow.querySelector('[data-slot-id="a"] .oim-parallax-track')).toBeNull();
  });

  it("a group clips when a child loops, and not for its old flags", async () => {
    const group = (id: string, style: object) => ({ id, type: "group", position: [0, 0], width_px: 200, height_px: 100, style });
    const child = (id: string, groupId: string) => ({ ...geo(id), style: { width: 50, height: 50, groupId } });
    const { engine } = await render(
      [group("g1", {}), child("cg1", "g1"), group("g2", { sceneLoop: { speedPxSec: 3 } }), child("cg2", "g2")],
      (l) => { l.get("cg1").motion = { loop: { speedPxSec: 10 } }; },
    );
    expect((engine._overlay.querySelector('[data-slot-id="g1"]') as HTMLElement).style.overflow).toBe("hidden");
    expect((engine._overlay.querySelector('[data-slot-id="g2"]') as HTMLElement).style.overflow).toBe("visible");
  });

  it("the pointer parallax is retired: no controller for a 2.0 layer", async () => {
    const { engine } = await render([geo("a", { parallax: { enabled: true, depth: 0.8, mode: "mouse" } })], () => {});
    expect(engine).not.toHaveProperty("_parallaxController");
  });
});
