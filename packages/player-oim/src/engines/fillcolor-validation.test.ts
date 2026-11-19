/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The player speaks the 1.5.0 contract onwards: one name per concept.
 *
 * The compiler (`canonizar_estilo`) now emits only the canonical names. A player
 * that kept reading the aliases would have TWO readings of the same file, and a
 * second reader written only from the contract would paint differently from the
 * official one.
 *
 * And there was a real bug hidden there: the compiler converts `color` into
 * `fillColor`, but the engine painted the letter with `style.color`. A new text
 * from the editor (`fillColor` without `fillType`) came out signed with no colour.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { buildArtisticTextModelFromSlot } from "../../../scene/src/blocks/artisticText";

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

async function textWith(style: any): Promise<HTMLElement> {
  const { host, motor } = mount([{
    id: "t", type: "text", align: "left",
    position: [50, 50], width_px: 300, height_px: 80,
    content: { es: "hola" },
    style: { fontSize: "48px", ...style },
  }]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
}

describe("structural validation checks the current keys", () => {
  it("a fillColor that is not text or is huge invalidates the layer", async () => {
    const { validateOimMetadata } = await import("../render/security");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: 42 } }] })).toContain("slot[0].style.fillColor invalid");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: "x".repeat(65) } }] })).toContain("slot[0].style.fillColor invalid");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: "#fff" } }] })).toEqual([]);
  });

  it("`color`, retired, is no longer validated: it is not painted", async () => {
    const { validateOimMetadata } = await import("../render/security");
    expect(validateOimMetadata({ slots: [{ style: { color: 42 } }] })).toEqual([]);
  });
});
