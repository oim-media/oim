/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, media filters: an image, an image fill and a filter layer filter from their 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

async function render(slot: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = { canvas: { natural_width: 800, natural_height: 600 }, slots: [{ id: "a", position: [10, 10], ...slot }] };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old filter would show.
  edit(v2LayersOf(engine.metadata).get("a")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="a"]') as HTMLElement;
}

describe("media filters paint from the 2.0 layer", () => {
  it("an image's picture", async () => {
    const el = await render({ type: "image", content: { es: PNG }, style: { width: 100, height: 100, filterPreset: "sepia" } }, (l) => {
      l.image.filters = { preset: "grayscale", brightness: 1.2 };
    });
    expect(el.querySelector("img")!.style.filter).toBe("grayscale(1) brightness(120%)");
  });

  it("a shape's image fill", async () => {
    const el = await render({ type: "geo", content: { es: "" }, style: { width: 100, height: 100, fillType: "image", fillImage: PNG, filterPreset: "sepia" } }, (l) => {
      l.fills.find((p: any) => p.kind === "image").filters = { hueRotate: 30 };
    });
    expect(el.querySelector(".oim-image-fill img") as HTMLElement).toBeTruthy();
    expect((el.querySelector(".oim-image-fill img") as HTMLElement).style.filter).toBe("hue-rotate(30deg)");
  });

  it("what is behind a filter layer", async () => {
    const el = await render({ type: "filter", content: { es: "" }, style: { width: 100, height: 100, filterPreset: "sepia" } }, (l) => {
      l.effects = [{ kind: "backdrop", blur: 4, contrast: 1.1 }];
    });
    expect(el.style.backdropFilter).toBe("blur(4px) contrast(110%)");
  });
});
