/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The box's corners come from the 2.0 `corners`; 1.x dumped `borderRadius` as raw CSS.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

async function slot(style: any): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots: [{ id: "c", type: "geo", position: [10, 10], width_px: 200, height_px: 200, content: {}, style: { fillColor: "#ff0000", ...style } }], width: 800, height: 600 };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="c"]') as HTMLElement;
}

describe("corners", () => {
  it("a rounded rectangle keeps its radius", async () => {
    expect((await slot({ borderRadius: "12px" })).style.borderRadius).toBe("12px");
  });
  it("each corner on its own", async () => {
    expect((await slot({ borderRadiusTL: "4px", borderRadiusTR: "8px" })).style.borderRadius).toBe("4px 8px 0px 0px");
  });
  it("a circle stays round whatever borderRadius says", async () => {
    expect((await slot({ geoShape: "circle", borderRadius: "8px" })).style.borderRadius).not.toBe("8px");
  });
  it("raw CSS in a 1.x style is not painted", async () => {
    expect((await slot({ boxShadow: "0 0 4px red" })).style.boxShadow).toBe("");
  });
});
