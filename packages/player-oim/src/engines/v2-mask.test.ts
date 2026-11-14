/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, mask: its mode, figure, frame and outline come from the 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "m", type: "mask", align: "left", position: [10, 10], width_px: 300, height_px: 200, content: { es: "" }, style }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old mask would show.
  edit(v2LayersOf(engine.metadata).get("m")!);
  await engine.renderSlots();
  return shadow as ShadowRoot;
}

const old = { maskMode: "window", maskShape: "circle", maskBgColor: "#111111", maskStrokeColor: "#222222", maskStrokeWidth: 9 };

describe("a mask comes from its 2.0 layer", () => {
  it("a window's frame and outline", async () => {
    const shadow = await render(old, (l) => {
      l.fills = [{ kind: "color", value: "#ff0000" }];
      l.strokes = [{ paint: { kind: "color", value: "#00ff00" }, width: 4 }];
    });
    const paths = shadow.querySelectorAll('[data-slot-id="m"] path');
    expect(paths[0].getAttribute("fill")).toBe("#ff0000");
    expect(paths[1].getAttribute("stroke")).toBe("#00ff00");
    expect(paths[1].getAttribute("stroke-width")).toBe("4");
  });

  it("its scope: in its own box, the frame stops at the box", async () => {
    const shadow = await render(old, (l) => { l.mask = { scope: "group" }; });
    expect(shadow.querySelector('[data-slot-id="m"] path')!.getAttribute("d")).not.toMatch(/^M0 0H800/);
    const canvas = await render(old, () => {});
    expect(canvas.querySelector('[data-slot-id="m"] path')!.getAttribute("d")).toMatch(/^M0 0H800/);
  });

  it("its figure", async () => {
    const rect = await render(old, (l) => { l.geometry = { kind: "rect" }; });
    const circle = await render(old, () => {});
    const d = (s: ShadowRoot) => s.querySelector('[data-slot-id="m"] path')!.getAttribute("d");
    expect(d(rect)).not.toBe(d(circle));
  });

  it("a cutout paints nothing of its own", async () => {
    const shadow = await render(old, (l) => { l.mask = { mode: "cutout" }; });
    expect(shadow.querySelector('[data-slot-id="m"]')).toBeNull();
  });
});
