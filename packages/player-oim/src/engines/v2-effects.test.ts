/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, effects: what a layer's effects paint comes from its 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(type: string, style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "a", type, position: [10, 10], content: { es: "Hola" }, style: { width: 100, height: 100, fontSize: "5cqw", ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old paint would show.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="a"]') as HTMLElement;
}

describe("a layer's effects paint from its 2.0 layer", () => {
  it("a shape: blur, glow and shadow on its silhouette, in order", async () => {
    const el = await render("geo", { layerBlur: 9 }, (l) => {
      l.effects = [
        { kind: "blur", radius: 2 },
        { kind: "glow", radius: 10, color: "#00ff00" },
        { kind: "shadow", x: 1, y: 2, blur: 3, color: "#0000ff" },
      ];
    });
    expect(el.style.filter).toBe("blur(2px) drop-shadow(0px 0px 4px #00ff00) drop-shadow(0px 0px 10px #00ff00) drop-shadow(1px 2px 3px #0000ff)");
  });

  it("a text: glow and shadow follow the glyphs", async () => {
    const el = await render("text", { effect: "neon" }, (l) => {
      l.effects = [{ kind: "shadow", y: 4, blur: 2, color: "#ff0000", opacity: 0.5 }];
    });
    expect(el.style.textShadow).toContain("rgba(255, 0, 0, 0.5)");
    expect(el.style.filter).toBe("");
  });

  it("no effects, nothing painted, whatever 1.x said", async () => {
    const el = await render("geo", { effect: "neon", layerBlur: 4, shadowEnabled: true }, (l) => { delete l.effects; });
    expect(el.style.filter).toBe("");
  });
});
