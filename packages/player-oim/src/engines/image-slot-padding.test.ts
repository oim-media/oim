/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An image slot has no text padding, and its parallax track starts at its
 * left edge.
 *
 * `.oim-slot` carries `padding: 0 0.25em 0 0 !important` so the last italic
 * letter of a text is not cut. A slot that paints no text drops it — but the
 * check was `!rawText`, and for an image `rawText` is its source, so images
 * kept it: the box grew 3.5 px, its -50% centring shifted it 1.75 px left,
 * and at the end of every parallax lap a strip of that width showed through
 * (library, 4 Oct 2026). happy-dom does no layout; the layout was measured in
 * the browser.
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[]) {
  const host = document.createElement("div");
  (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  host.shadowRoot!.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 576, height: 324 };
  return { host, motor };
}

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const image = (style: any = {}) => ({
  id: "img", type: "image", align: "center",
  position: [0.5, 0.5], width_px: 576, height_px: 324,
  content: { "*": PNG },
  style: { width: "100cqw", height: "56.25cqw", ...style },
});

async function slot(slots: any[], id: string): Promise<HTMLElement> {
  const { host, motor } = montar(slots);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector(`[data-slot-id="${id}"]`) as HTMLElement;
}

describe("an image slot", () => {
  it("drops the text padding", async () => {
    const el = await slot([image()], "img");
    expect(el.style.getPropertyValue("padding")).toBe("0px");
    expect(el.style.getPropertyPriority("padding")).toBe("important");
  });

  it("a text slot keeps it", async () => {
    const text = { id: "t", type: "text", align: "left", position: [0.5, 0.5], width_px: 300, height_px: 80, content: { es: "hola" }, style: { fontSize: "48px" } };
    const el = await slot([text], "t");
    expect(el.style.getPropertyValue("padding")).not.toBe("0px");
  });

  it("its parallax track starts at its left edge", async () => {
    const parallax = { enabled: true, depth: 1, mode: "infinite_horizontal", axis: "x_only", infinite: { enabled: true, speedPxSec: 20, direction: "right_to_left", seamlessTile: false, pauseOnHover: false } };
    const el = await slot([image({ parallax })], "img");
    const track = el.querySelector(".oim-parallax-pista") as HTMLElement;
    expect(track).not.toBeNull();
    expect(track.style.getPropertyValue("align-self")).toBe("flex-start");
    expect(el.style.getPropertyValue("--oim-tx")).toBe("0%");
    expect(el.style.alignItems).toBe("flex-start");
  });
});
