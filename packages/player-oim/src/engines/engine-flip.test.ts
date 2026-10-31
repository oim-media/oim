/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The layer flip (contract 1.14.0) is painted in an inner element: the slot
// keeps its rotation and its animations, which rewrite its own transform.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

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

const caja = (style: any) => ({
  id: "caja", type: "geo", align: "left",
  position: [50, 50], width_px: 200, height_px: 100,
  content: { es: "" },
  style: { geoShape: "rectangle", fillColor: "#7ec8f0", fillType: "color", ...style },
});

describe("layer flip in the player", () => {
  it("flipX paints scale(-1, 1) inside; the slot keeps its rotation", async () => {
    const { host, motor } = montar([caja({ flipX: true, rotation: 30 })]);
    await motor.renderSlots();
    const slot = host.shadowRoot!.querySelector('[data-slot-id="caja"]') as HTMLElement;
    const inner = slot.querySelector(":scope > [data-oim-flip]") as HTMLElement;
    expect(inner.style.transform).toBe("scale(-1, 1)");
    expect(slot.style.getPropertyValue("--oim-rot")).toBe("30deg");
    expect(slot.style.transform).not.toContain("scale(-1");
  });

  it("flipY flips the other axis", async () => {
    const { host, motor } = montar([caja({ flipY: true })]);
    await motor.renderSlots();
    const inner = host.shadowRoot!.querySelector('[data-slot-id="caja"] > [data-oim-flip]') as HTMLElement;
    expect(inner.style.transform).toBe("scale(1, -1)");
  });

  it("without a flip the slot is as before", async () => {
    const { host, motor } = montar([caja({})]);
    await motor.renderSlots();
    expect(host.shadowRoot!.querySelector("[data-oim-flip]")).toBeNull();
  });
});

describe("a flipped group mirrors its children", () => {
  const capa = (id: string, extra: any = {}) => ({
    id, type: "geo", content: { es: "" }, position: [0.1, 0.1], width_px: 100, height_px: 100,
    ...extra, style: { fillColor: "#ff0000", ...(extra.style || {}) },
  });

  it("the children go inside the group's flip element, also after a repaint", async () => {
    const { host, motor } = montar([
      capa("g1", { type: "group", width_px: 200, height_px: 100, style: { flipX: true } }),
      capa("a", { style: { groupId: "g1" } }),
    ]);
    await motor.renderSlots();
    const flip = () => host.shadowRoot!.querySelector('[data-slot-id="g1"] > [data-oim-flip]') as HTMLElement;
    expect(flip().querySelector('[data-slot-id="a"]')).not.toBeNull();
    await motor.renderSlots();
    expect(flip().querySelector('[data-slot-id="a"]')).not.toBeNull();
  });
});

