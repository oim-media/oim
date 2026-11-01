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
import { DEFAULT_LINE_HEIGHT } from "../../../core/src/typography.js";

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

const text = (style: any = {}) => ({
  id: "t", type: "text", align: "left",
  position: [50, 50], width_px: 300, height_px: 80,
  content: { es: "ejemplo" },
  style: { fontSize: "24px", ...style },
});

async function lineHeightOf(style: any = {}): Promise<string> {
  const { host, motor } = mount([text(style)]);
  await motor.renderSlots();
  const el = host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
  return el.style.lineHeight;
}

describe("el interlineado en el motor", () => {
  it("is written to the element", async () => {
    expect(await lineHeightOf({ lineHeight: 1.6 })).toBe("1.6");
  });

  /** What published .oim files carry: a string, not a number. */
  it("reads the chain from the real files", async () => {
    expect(await lineHeightOf({ lineHeight: "1.2" })).toBe("1.2");
  });

  /**
   * Without this value the player would use the browser's `normal` -which
   * depends on the font, is around 1.15-1.2 and is not fixed- and would again
   * diverge from the editor.
   */
  it("a layer that does not state it receives the same value the editor paints", async () => {
    expect(await lineHeightOf()).toBe(String(DEFAULT_LINE_HEIGHT));
  });

  /**
   * UNITLESS. With `px` or `em` the value is inherited already computed, so a
   * child with a different font size would receive the parent's line height.
   */
  it("is written without a unit, so it is inherited as a factor", async () => {
    const valueItem = await lineHeightOf({ lineHeight: 2 });
    expect(valueItem).toBe("2");
    expect(valueItem).not.toMatch(/px|em|rem|%/);
  });

  it("an impossible value does not reach the DOM", async () => {
    expect(await lineHeightOf({ lineHeight: 0 })).toBe(String(DEFAULT_LINE_HEIGHT));
    expect(await lineHeightOf({ lineHeight: "alto" })).toBe(String(DEFAULT_LINE_HEIGHT));
    // Clamped to the maximum the editor offers, not discarded.
    expect(await lineHeightOf({ lineHeight: 99 })).toBe("3");
  });
});
