/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, interactions: what a press or a hover does comes from the 2.0 layer.
import { describe, expect, it, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(slot: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  shadow.appendChild(engine._viewport);
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  const geo = (id: string) => ({ id, type: "geo", position: [10, 10], content: { es: "" }, style: { width: 10, height: 10 } });
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ ...geo("a"), ...slot, style: { ...geo("a").style, ...(slot as any).style } }, geo("b"), geo("c")],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old actions would run.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  const events: any[] = [];
  host.addEventListener("oim:action", (e: any) => { events.push(e.detail); e.preventDefault(); });
  const el = shadow.querySelector('[data-slot-id="a"]') as HTMLElement;
  return { el, events, engine };
}

const old = { style: { isInteractive: true, states: { active: { actions: [{ type: "hide", target: "c" }] } } } };

describe("a layer's interactions come from its 2.0 layer", () => {
  it("a press runs the 2.0 actions", async () => {
    const { el, events } = await render(old, (l) => { l.interactions = [{ on: "press", actions: [{ type: "show", target: "b" }] }]; });
    el.click();
    expect(events).toMatchObject([{ trigger: "click", targets: ["b"], types: ["show"] }]);
  });

  it("a hover runs its own actions", async () => {
    const { el, events } = await render(old, (l) => { l.interactions = [{ on: "hover", actions: [{ type: "toggle", target: "c" }] }]; });
    el.dispatchEvent(new Event("mouseenter"));
    expect(events).toMatchObject([{ trigger: "hover", targets: ["c"] }]);
  });

  it("the old toggle of the layer runs through the same road", async () => {
    const toggle = { interaction: { action_type: "toggle_elements", target: { hide_slots: ["c"] } } };
    const { el, events, engine } = await render(toggle, (l) => { l.interactions = [{ on: "press", actions: [{ type: "show", target: "b" }] }]; });
    const old = vi.spyOn(engine, "executeToggleState");
    el.click();
    expect(events).toMatchObject([{ targets: ["b"] }]);
    expect(old).not.toHaveBeenCalled();
  });

  it("no interactions in 2.0, a press does nothing, whatever 1.x said", async () => {
    const { el, events } = await render(old, (l) => { delete l.interactions; delete l.animations; });
    el.click();
    expect(events).toEqual([]);
  });
});
