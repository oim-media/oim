/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Frame shapes (contract 1.19.0): a photo frame's outline comes from @oim-media/core,
// a custom svgPath can frame a photo, and the photo can be mirrored inside the
// frame without mirroring the outline.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";
import { frameSilhouette } from "../../../core/src/frame-silhouette.js";

const FOTO = "data:image/png;base64,iVBORw0KGgo=";

async function slotDe(style: any): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = {
    slots: [{ id: "c", type: "geo", position: [10, 10], width_px: 200, height_px: 200, content: {}, style }],
    width: 800, height: 600,
  };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="c"]') as HTMLElement;
}

const box = (el: HTMLElement) => el.querySelector(".oim-image-fill") as HTMLElement | null;
// The stroke drawing: the svg that is a direct child of the slot.
const strokeItem = (el: HTMLElement) => Array.from(el.children).find((h) => h.tagName.toLowerCase() === "svg") as SVGElement;

describe("a photo frame's outline comes from frameSilhouette", () => {
  it("a cloud frame with a photo is clipped by the silhouette's own path", async () => {
    const el = await slotDe({ geoShape: "cloud", fillType: "image", fillImage: FOTO });
    const clip = box(el)!.querySelector('clipPath[clipPathUnits="objectBoundingBox"] path') as SVGPathElement;
    expect(clip.getAttribute("d")).toBe(frameSilhouette({ geoShape: "cloud" })!.d);
  });
});

describe("a custom svgPath frame with a photo", () => {
  it("paints the photo, clipped by the svgPath", async () => {
    const el = await slotDe({ svgPath: "M0 0L100 0L50 100Z", fillType: "image", fillImage: FOTO });
    expect(box(el)!.querySelector("img")).not.toBeNull();
    const clip = box(el)!.querySelector("clipPath path") as SVGPathElement;
    expect(clip.getAttribute("d")).toBe("M0 0L100 0L50 100Z");
  });
});

describe("a custom svgPath keeps its colour fill off", () => {
  it("with fillColor and no photo the figure stays fill none", async () => {
    const el = await slotDe({ svgPath: "M0 0L100 0L50 100Z", fillColor: "#ff0000" });
    expect(strokeItem(el).firstElementChild!.getAttribute("fill")).toBe("none");
  });
});

describe("fillImageFlipX / fillImageFlipY", () => {
  it("mirror the photo and never the silhouette", async () => {
    const el = await slotDe({ geoShape: "bolt", fillType: "image", fillImage: FOTO, fillImageFlipX: true });
    const img = box(el)!.querySelector("img") as HTMLImageElement;
    expect(img.style.transform).toContain("scale(-1, 1)");
    const clip = box(el)!.querySelector("clipPath path") as SVGPathElement;
    expect(clip.getAttribute("transform") ?? "").not.toMatch(/-1/);
    expect(strokeItem(el).firstElementChild!.getAttribute("transform") ?? "").not.toMatch(/-1/);
  });

  it("FlipY mirrors the photo vertically", async () => {
    const el = await slotDe({ geoShape: "bolt", fillType: "image", fillImage: FOTO, fillImageFlipY: true });
    const img = box(el)!.querySelector("img") as HTMLImageElement;
    expect(img.style.transform).toContain("scale(1, -1)");
  });
});

describe("an unknown geoShape with a photo", () => {
  it("paints the whole photo with no clip shape and no error", async () => {
    const el = await slotDe({ geoShape: "nope", fillType: "image", fillImage: FOTO });
    expect(box(el)!.querySelector("img")).not.toBeNull();
    const clip = box(el)!.querySelector("clipPath rect") as SVGRectElement;
    expect(clip.getAttribute("width")).toBe("1");
    expect(clip.getAttribute("height")).toBe("1");
  });
});
