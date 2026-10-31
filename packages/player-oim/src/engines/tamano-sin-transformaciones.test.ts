/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The player sizes itself from its layout box, not from its on-screen
// rectangle: inside a transformed parent (the landing's 3D carousel, a centre
// card at translateZ(120px)) getBoundingClientRect is bigger than the box, so
// a cover-fitted image came out zoomed, «sometimes» — depending on where the
// card was when the .oim finished loading.
import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function engineIn(layout: { w: number; h: number }, onScreen: { w: number; h: number }) {
  const host = document.createElement("div") as any;
  Object.defineProperty(host, "offsetWidth", { value: layout.w });
  Object.defineProperty(host, "offsetHeight", { value: layout.h });
  host.getBoundingClientRect = () => ({ width: onScreen.w, height: onScreen.h, top: 0, left: 0, right: onScreen.w, bottom: onScreen.h });
  host.attachShadow({ mode: "open" });
  const motor: any = new ImageEngine(host);
  motor._viewport = document.createElement("div");
  Object.defineProperty(motor._viewport, "offsetWidth", { get: () => parseFloat(motor._viewport.style.width) || 0 });
  motor._viewport.getBoundingClientRect = () => ({ width: (parseFloat(motor._viewport.style.width) || 0) * (onScreen.w / layout.w) });
  motor.fit = "cover";
  motor.metadata = { canvas: { natural_width: 900, natural_height: 1600 }, slots: [] };
  return motor;
}

describe("player size ignores its parent's transforms", () => {
  it("a cover image fills the layout box, not the bigger on-screen rectangle", () => {
    const m = engineIn({ w: 360, h: 640 }, { w: 432, h: 768 }); // projected 1.2x by a 3D parent
    m.updateViewportSize();
    expect(m._viewport.style.width).toBe("360px");
    expect(m._viewport.style.height).toBe("640px");
  });

  it("the layers' scale comes from the layout width too", () => {
    const m = engineIn({ w: 360, h: 640 }, { w: 432, h: 768 });
    m.updateViewportSize();
    m.updateScale();
    expect(m.host.style.getPropertyValue("--oim-fit") || m._viewport.style.getPropertyValue("--oim-fit")).toBe((360 / 900).toFixed(6));
  });
});
