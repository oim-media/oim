/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, states: the look a layer takes under the pointer comes from its 2.0 hover animation.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function hover(style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._viewport = document.createElement("div");
  shadow.appendChild(engine._viewport);
  engine._overlay = document.createElement("div");
  engine._viewport.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "a", type: "geo", position: [10, 10], content: { es: "" }, style: { width: 10, height: 10, isInteractive: true, ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old look would show.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  const written: Record<string, string>[] = [];
  engine.queueUpdate = (_el: HTMLElement, styles: Record<string, string>) => { written.push(styles); };
  (shadow.querySelector('[data-slot-id="a"]') as HTMLElement).dispatchEvent(new Event("mouseenter"));
  return written[0];
}

describe("the hover look comes from the 2.0 layer", () => {
  it("its scale, rotation and opacity, and its transition in seconds for the stylesheet", async () => {
    const look = await hover({ states: { hover: { scale: 105, transitionDuration: 9 } } }, (l) => {
      l.animations = [{
        on: "hover",
        duration: 400,
        tracks: [
          { property: "scale", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 1.2 }] },
          { property: "rotation", keyframes: [{ t: 0, v: 0 }, { t: 1, v: 15 }] },
          { property: "opacity", keyframes: [{ t: 0, v: 1 }, { t: 1, v: 0.7 }] },
        ],
      }];
    });
    expect(look).toEqual({ "--oim-slot-hover-scale": "1.2", "--oim-rot": "15deg", opacity: "0.7", "--oim-transition-duration": "0.4s" });
  });

  it("no duration of its own: the stylesheet's transition stands", async () => {
    const look = await hover({ states: { hover: { scale: 105 } } }, () => {});
    expect(look).toEqual({ "--oim-slot-hover-scale": "1.05" });
  });

  it("no hover look in 2.0, nothing changes, whatever 1.x said", async () => {
    const look = await hover({ states: { hover: { scale: 105, opacity: 50 } } }, (l) => { delete l.animations; });
    expect(look).toEqual({});
  });
});
