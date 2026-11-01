/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Image crop (contract 1.15.0): the image keeps covering its frame, framed
// at x/y and zoomed around that point; whatever overflows is clipped.

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

const foto = (style: any) => ({
  id: "foto", type: "image", align: "left",
  position: [50, 50], width_px: 300, height_px: 200,
  content: { "*": "https://cdn.oim.media/demo.png" },
  style: { fillColor: "#000000", ...style },
});

const img = (host: HTMLElement) => host.shadowRoot!.querySelector('[data-slot-id="foto"] img') as HTMLImageElement;

describe("image crop in the player", () => {
  it("frames and zooms the image, and clips what overflows", async () => {
    const { host, motor } = mount([foto({ objectFit: "contain", imageCrop: { x: 20, y: 70, zoom: 2 } })]);
    await motor.renderSlots();
    const i = img(host);
    expect(i.style.objectFit).toBe("cover");
    expect(i.style.objectPosition).toBe("20% 70%");
    expect(i.style.transform).toBe("scale(2)");
    expect(i.style.transformOrigin).toBe("20% 70%");
    expect(i.parentElement!.style.overflow).toBe("hidden");
  });

  it("without a crop the image is as before", async () => {
    const { host, motor } = mount([foto({ objectFit: "contain" })]);
    await motor.renderSlots();
    expect(img(host).style.objectFit).toBe("contain");
    expect(img(host).style.transform).toBe("");
  });
});
