/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The long-standing gap: making sure the rule reaches the DOM.
 *
 * `tipografia.test.ts` pins the NUMBER; this pins that the engine writes it to
 * the element, unitless and on the text slot. Without this test, deleting the
 * engine's line left the 17 core tests green while the file's value reached the
 * element raw through the generic dump of `style`, and a layer that does not
 * carry it fell back to the browser's `normal`.
 *
 * The measured cut: the editor paints at 1.25, the player did not read the
 * field, and the box came out lower than expected. With `overflow: hidden` on
 * the slot, the descenders -"j", "p", "g"- were cut off at the bottom.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { DEFAULT_LINE_HEIGHT } from "../core/typography";

function montar(slots: any[]) {
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

const text = (style: any = {}) => ({
  id: "t", type: "text", align: "left",
  position: [50, 50], width_px: 300, height_px: 80,
  content: { es: "ejemplo" },
  style: { fontSize: "24px", ...style },
});

async function interlineadoDe(style: any = {}): Promise<string> {
  const { host, motor } = montar([text(style)]);
  await motor.renderSlots();
  const el = host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
  return el.style.lineHeight;
}

describe("el interlineado en el motor", () => {
  it("se escribe en el elemento", async () => {
    expect(await interlineadoDe({ lineHeight: 1.6 })).toBe("1.6");
  });

  /** What published .oim files carry: a string, not a number. */
  it("lee la cadena de los archivos reales", async () => {
    expect(await interlineadoDe({ lineHeight: "1.2" })).toBe("1.2");
  });

  /**
   * Without this value the player would use the browser's `normal` -which
   * depends on the font, is around 1.15-1.2 and is not fixed- and would again
   * diverge from the editor.
   */
  it("una capa que no lo dice recibe el mismo valor que pinta el editor", async () => {
    expect(await interlineadoDe()).toBe(String(DEFAULT_LINE_HEIGHT));
  });

  /**
   * UNITLESS. With `px` or `em` the value is inherited already computed, so a
   * child with a different font size would receive the parent's line height.
   */
  it("va sin unidad, para que se herede como factor", async () => {
    const valor = await interlineadoDe({ lineHeight: 2 });
    expect(valor).toBe("2");
    expect(valor).not.toMatch(/px|em|rem|%/);
  });

  it("un valor imposible no llega al DOM", async () => {
    expect(await interlineadoDe({ lineHeight: 0 })).toBe(String(DEFAULT_LINE_HEIGHT));
    expect(await interlineadoDe({ lineHeight: "alto" })).toBe(String(DEFAULT_LINE_HEIGHT));
    // Clamped to the maximum the editor offers, not discarded.
    expect(await interlineadoDe({ lineHeight: 99 })).toBe("3");
  });
});
