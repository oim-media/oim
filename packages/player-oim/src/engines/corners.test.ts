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
  return host.shadowRoot!.querySelector('[data-oim-id="c"]') as HTMLElement;
}

describe("a 1.x style's raw CSS", () => {
  it("is not painted, while what the contract carries is", async () => {
    const el = await slot({ borderRadius: "12px", boxShadow: "0 0 4px red" });
    expect(el.style.borderRadius).toBe("12px");
    expect(el.style.boxShadow).toBe("");
  });
});
