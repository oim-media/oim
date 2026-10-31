/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Media filters (contract 1.18.0): an image layer's picture and a photo frame's
// picture carry the filter; the stroke drawing and the slot container never do.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { FILTER_PRESET_CSS } from "../../../core/src/media-filters.js";

const FOTO = "data:image/png;base64,iVBORw0KGgo=";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function slotDe(slots: any[], id: string): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector(`[data-slot-id="${id}"]`) as HTMLElement;
}

const imagen = (style: any = {}) => ({
  id: "img", type: "image", align: "center", position: [0.5, 0.5], width_px: 200, height_px: 200,
  content: { "*": PNG }, style: { width: "100cqw", height: "56.25cqw", ...style },
});

const forma = (style: any = {}) => ({
  id: "c", type: "geo", position: [10, 10], width_px: 200, height_px: 200, content: {},
  style: { geoShape: "circle", fillType: "image", fillImage: FOTO, ...style },
});

describe("media filters on an image layer", () => {
  it("a grayscale preset is set on the picture", async () => {
    const el = await slotDe([imagen({ filterPreset: "grayscale" })], "img");
    const img = el.querySelector("img") as HTMLImageElement;
    expect(img.style.filter).toBe(FILTER_PRESET_CSS.grayscale);
  });

  it("neutral adjustments leave no filter in the DOM", async () => {
    const el = await slotDe([imagen({ filterPreset: "none", filterBlur: 0, filterHueRotate: 0, filterBrightness: 100 })], "img");
    const img = el.querySelector("img") as HTMLImageElement;
    expect(img.style.filter).toBe("");
  });
});

describe("media filters on a non-image slot", () => {
  it("a text slot whose content is a data:image gets no filter on its picture", async () => {
    const el = await slotDe([{ id: "t", type: "text", align: "center", position: [0.5, 0.5], width_px: 200, height_px: 200, content: { "*": PNG }, style: { filterPreset: "grayscale" } }], "t");
    const img = el.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.style.filter).toBe("");
  });
});

describe("media filters on a photo frame", () => {
  it("blur goes on the picture; the stroke drawing and the container have none", async () => {
    const el = await slotDe([forma({ filterBlur: 6, strokeWidth: 3, strokeColor: "#111111" })], "c");
    const img = el.querySelector(".oim-image-fill img") as HTMLImageElement;
    expect(img.style.filter).toBe("blur(6px)");
    const trazo = Array.from(el.children).find((h) => h.tagName.toLowerCase() === "svg") as SVGElement;
    expect(trazo.style.filter).toBe("");
    expect(trazo.firstElementChild!.getAttribute("style") ?? "").not.toMatch(/filter/);
    expect(el.style.filter).toBe("");
  });

  it("neutral adjustments on a photo frame leave no filter", async () => {
    const el = await slotDe([forma({ filterBlur: 0, filterBrightness: 100 })], "c");
    const img = el.querySelector(".oim-image-fill img") as HTMLImageElement;
    expect(img.style.filter).toBe("");
  });
});
