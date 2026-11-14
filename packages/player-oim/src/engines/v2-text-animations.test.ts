/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, text animations: the preset, its speed and its delay come from the 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";
import { applyWaveText } from "../../../scene/src/legacy/renderer.js";

async function render(style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  shadow.appendChild(engine._viewport);
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  engine.lang = "es";
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "t", type: "text", position: [10, 10], content: { es: "Hola" }, style: { fontSize: "5cqw", ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old animation would run.
  edit(v2LayersOf(engine.metadata).get("t")!);
  await engine.renderSlots();
  return shadow;
}

const delays = (root: ParentNode) => [...root.querySelectorAll("span")].map((s) => (s as HTMLElement).style.animationDelay).filter(Boolean);

describe("a text animates from its 2.0 layer", () => {
  it("its preset", async () => {
    const shadow = await render({ textAnimationType: "fade-chars" }, (l) => { l.animations[0].preset = "rise-words"; });
    expect(shadow.getElementById("oim-entrance-rise-words")).not.toBeNull();
    expect(shadow.getElementById("oim-entrance-fade-chars")).toBeNull();
  });

  it("its speed and its delay, in seconds for the browser", async () => {
    const shadow = await render({ textAnimationType: "wave-chars", textAnimationSpeed: 0.05, textAnimationDelay: 0 }, (l) => {
      l.animations[0].params = { speed: 0.2 };
      l.animations[0].delay = 2000;
    });
    const expected = document.createElement("div");
    applyWaveText(expected, "Hola", 0.2, 2);
    expect(delays(shadow).length).toBe(4);
    expect(delays(shadow)).toEqual(delays(expected));
  });

  it("no animation in 2.0, the text is drawn still, whatever 1.x said", async () => {
    const shadow = await render({ textAnimationType: "fade-chars" }, (l) => { delete l.animations; });
    expect(shadow.querySelector("span.oim-entrance")).toBeNull();
    expect(shadow.textContent).toContain("Hola");
  });
});
