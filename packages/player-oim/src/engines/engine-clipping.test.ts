/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * That the rule reaches the element.
 *
 * `recorte.test.ts` pins the decision; this pins that the engine writes it, and above
 * all that the parallax group STILL CLIPS: it is the only case in which clipping is the
 * effect, and the one that breaks if someone reorders the rules.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

async function recorteDe(slot: any): Promise<string> {
  const { host, motor } = mount([{ id: "s", position: [50, 50], ...slot }]);
  await motor.renderSlots();
  return (host.shadowRoot!.querySelector('[data-slot-id="s"]') as HTMLElement).style.overflow;
}

const text = (extra: any = {}) => ({
  type: "text", align: "left", content: { es: "ejemplo jpg" },
  style: { fontSize: "48px", ...extra },
});

describe("el recorte en el motor", () => {
  /**
   * The measured failure: with `line-height: 1.2`, Poppins cuts 0.70 px of ink off the
   * bottom at 48 px and Playfair Display 0.20. These are the two fonts of the real .oim
   * files, and the cut grows with the size.
   */
  it("a text does not clip its own glyphs", async () => {
    expect(await recorteDe(text())).toBe("visible");
  });

  /**
   * Here it is NOT checked that «any layer clips»: the engine writes `overflow` again later
   * in three other branches (the SVG and shape ones) so that the stroke is not cut, so a
   * geometric figure ends up as `visible` by a different path. Asserting it here would test
   * those branches, not this rule. `recorte.test.ts` covers the decision; this covers the wire.
   */

  /**
   * Its clipping IS the effect: the box is the window the track passes through.
   * If the text rule won over this one, a headline loop would show the whole tape
   * and stop being a loop.
   */
  it("a PARALLAX group of TEXT keeps clipping", async () => {
    expect(await recorteDe({ ...text(), isParallaxGroup: true })).toBe("hidden");
  });
});
