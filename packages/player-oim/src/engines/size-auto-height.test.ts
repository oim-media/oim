/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// `<oim-player style="display:block;width:800px">` has no height of its own: it takes it
// from the viewport. Sizing the viewport from that height pinned it to whatever size it
// had before (the base picture's, or a first guess), so a 2.0 file with a small poster
// rendered small and centred instead of filling the width.
import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function engineWithAutoHeight(poster: { w: number; h: number }) {
  const host = document.createElement("div") as any;
  host.attachShadow({ mode: "open" });
  const motor: any = new ImageEngine(host);
  const viewport = document.createElement("div");
  // The host is 800 wide; its height is the viewport's own, which is nothing once it is out of the flow.
  Object.defineProperty(host, "offsetWidth", { value: 800 });
  Object.defineProperty(host, "offsetHeight", { get: () => (viewport.style.display === "none" ? 0 : parseFloat(viewport.style.height) || poster.h) });
  motor._viewport = viewport;
  motor._baseImg = { naturalWidth: poster.w, naturalHeight: poster.h };
  motor.fit = "contain";
  motor.metadata = { oim: "2.0.0-draft.1", canvas: { width: 1200, height: 675 }, layers: [] };
  return motor;
}

describe("a host with no height of its own", () => {
  it("fills its width, whatever the size of the poster", () => {
    const m = engineWithAutoHeight({ w: 480, h: 270 });
    m.updateViewportSize();
    expect([m._viewport.style.width, m._viewport.style.height]).toEqual(["800px", "450px"]);
    m.updateViewportSize();
    expect([m._viewport.style.width, m._viewport.style.height]).toEqual(["800px", "450px"]);
  });

  it("leaves the viewport shown", () => {
    const m = engineWithAutoHeight({ w: 480, h: 270 });
    m.updateViewportSize();
    expect(m._viewport.style.display).toBe("");
  });
});
