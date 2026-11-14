/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A duotone filter layer is read from its 2.0 backdrop effect, not from the 1.x style.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

async function render(preset: string) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = {
    slots: [
      { id: "foto", type: "geo", position: [10, 10], width_px: 200, height_px: 200, content: {}, style: { fillColor: "#ff0000" } },
      { id: "f", type: "filter", position: [0, 0], width_px: 800, height_px: 600, content: {}, style: { filterPreset: preset } },
    ],
    width: 800, height: 600,
  };
  await motor.renderSlots();
  return shadow as ShadowRoot;
}

describe("duotone filter layer", () => {
  it("defines its colour table", async () => {
    expect((await render("duotone")).querySelector("filter feComponentTransfer")).not.toBeNull();
  });
  it("another preset defines none", async () => {
    expect((await render("grayscale")).querySelector("filter feComponentTransfer")).toBeNull();
  });
});
