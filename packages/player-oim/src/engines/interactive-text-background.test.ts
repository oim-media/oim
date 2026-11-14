/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An interactive text must not paint a background with the colour of its own letter.
 *
 * The comment in `ImageEngine.ts` already says what must happen: "For text,
 * lottie, and image slots, the editor stores a highlight/selection color that
 * must NOT be rendered". The condition below broke it, because
 * `isGeoLike` swallows the interactivity:
 *
 * ```
 * const isInteractiveSlot = slot.isInteractive === true || … || Boolean(slot.states);
 * const isGeoLike = 'geo' | 'shape' | 'draw' | 'filter' | 'container' | … || isInteractiveSlot;
 * if (style.fillColor && isGeoLike && !isWindowMask) el.style.backgroundColor = style.fillColor;
 * ```
 *
 * In a text layer `fillColor` IS the colour of the letter (the editor itself says so when
 * creating it), so the slot was painted with the same colour as its text: a flat block with
 * the letter inside it, invisible.
 *
 * **How it was found.** By exporting a real .oim: a red button that in the editor was red
 * text on white, and in the player a red rectangle. The text was in the DOM (`textContent`
 * confirmed it) with
 * identical `color` and `background-color`.
 *
 * **It predates the click hook-up.** `isInteractiveSlot` also counts
 * `Boolean(slot.states)`, so any text with a hover state already came out like this. With the
 * editor's default colours it would be dark letters on a dark background: equally invisible,
 * and harder to notice.
 *
 * `isGeoLike` mixes two questions: "is a background painted?" and "does it need a box with
 * dimensions?". The interactive slots came in through the second and took the first as a
 * freebie. These tests pin the two separately.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function mount(slots: any[]) {
  const host = document.createElement("div");
  // `mode="full"` is REQUIRED here since the default became the still image: without it,
  // no slot is interactive and these tests (which are about interactive slots) would pass
  // without checking anything.
  host.setAttribute("mode", "full");
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

async function slotDe(slot: any): Promise<HTMLElement> {
  const { host, motor } = mount([slot]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="s"]') as HTMLElement;
}

const ROJO = "#b91c1c";

// Measurements copied from a real .oim (the button of `prueba_clic_y_esquinas`,
// exported from the editor). It matters that they are the real ones: the slot's box is
// computed from `style.width`/`height` in `cqw`, which is what the backend emits, and NOT
// from `width_px`, which is what the editor sends. A fixture with `width_px` leaves the
// width empty and any test on the box would measure nothing.
const text = (extra: any = {}) => ({
  id: "s", type: "text", align: "center",
  position: [7.5, 53.3333],
  content: { es: "PULSAME" },
  style: {
    width: "32.5cqw", height: "8.75cqw", fontSize: "2.75cqw",
    fillColor: ROJO, color: ROJO, ...extra,
  },
});

const forma = (extra: any = {}) => ({
  id: "s", type: "geo", align: "center",
  position: [7.5, 7.5],
  content: { es: "" },
  style: { width: "32.5cqw", height: "8.75cqw", fillColor: ROJO, ...extra },
});

const ACCION = { states: { active: { actions: [{ target: "other", type: "toggle" }] } } };

describe("the background of an interactive text", () => {
  it("a text marked interactive does NOT paint the background", async () => {
    const el = await slotDe(text({ isInteractive: true }));
    expect(el.style.backgroundColor).toBe("");
  });

  /**
   * The path that already existed before the click: it is enough for it to carry `states`
   * so that `isInteractiveSlot` counts it, without `isInteractive` in the middle.
   */
  it("and one with states does not either, even if nobody marked it", async () => {
    const el = await slotDe(text(ACCION));
    expect(el.style.backgroundColor).toBe("");
  });

  it("the text is still there, and with ITS colour", async () => {
    const el = await slotDe(text({ isInteractive: true }));
    expect(el.textContent).toContain("PULSAME");
    // What made the text invisible was not losing it: it was making the two equal.
    expect(el.style.backgroundColor).not.toBe(el.style.color);
  });

  it("a normal text did not have one either, and still does not", async () => {
    const el = await slotDe(text());
    expect(el.style.backgroundColor).toBe("");
  });
});

describe("what the fix must NOT take away", () => {
  it("an interactive SHAPE keeps its fill", async () => {
    // Here `fillColor` IS the fill of the shape: removing it from all the interactive
    // ones would have traded one bug for another.
    const el = await slotDe(forma({ isInteractive: true, ...ACCION }));
    expect(el.style.backgroundColor).toBeTruthy();
  });

  it("a normal shape too", async () => {
    const el = await slotDe(forma());
    expect(el.style.backgroundColor).toBeTruthy();
  });

  /**
   * An activatable slot needs area, or there is nowhere to press. It is guaranteed by
   * `applyMinHitArea` (WCAG 2.5.8, 24x24), and it is triggered by `isInteractiveSlot`,
   * the same flag that the fix touches. It is checked that it stays set.
   *
   * The minimum is measured, not the width: the width comes from `style.width` through
   * another branch that this bench does not exercise, so asserting on it would be measuring nothing.
   */
  // Ruling (13 Nov): in 2.0 a layer is interactive because it reacts (a hover look
  // or an interaction); the bare 1.x flag is not carried.
  it("an interactive text keeps its minimum contact area", async () => {
    const el = await slotDe(text({ isInteractive: true, states: { hover: { scale: 105 } } }));
    expect(el.style.minWidth).toBe("24px");
    expect(el.style.minHeight).toBe("24px");
  });

  it("and a NON-interactive one does not get it: it is for the clickable ones, not for all", async () => {
    const el = await slotDe(text());
    expect(el.style.minWidth).toBe("");
  });
});
