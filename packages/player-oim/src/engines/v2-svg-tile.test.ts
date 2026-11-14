/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3: a raw SVG background reads its fit and motion from the 2.0 pattern, not 1.x.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{
      id: "background-pattern-slot", type: "geo", position: [0, 0], is_background_pattern: true, content: { es: "" },
      style: { backgroundFit: "tile", svgRawXml: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="4" fill="#a3e635"/></svg>' },
    }],
  };
  edit(v2LayersOf(engine.metadata).get("background-pattern-slot")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="background-pattern-slot"]') as HTMLElement;
}

describe("a raw SVG background tile", () => {
  it("is a pattern after the upgrade, tiled by default", async () => {
    const el = await render((l) => expect(l.fills[0].kind).toBe("pattern"));
    expect(el.style.backgroundRepeat).toBe("repeat");
  });

  it("covers when its 2.0 pattern says so", async () => {
    const el = await render((l) => { l.fills[0].pattern.fit = "cover"; });
    expect(el.style.backgroundSize).toBe("cover");
  });
});
