/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Image fill in shapes (contract 1.17.0): a photo clipped by the silhouette,
// framed like an image layer's crop, under the stroke drawing.

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

const FOTO = "data:image/png;base64,iVBORw0KGgo=";

async function slotDe(style: any, slotExtra: any = {}): Promise<HTMLElement> {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = {
    slots: [{ id: "c", type: "geo", position: [10, 10], width_px: 200, height_px: 200, content: {}, style: { geoShape: "circle", ...style }, ...slotExtra }],
    width: 800, height: 600,
  };
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="c"]') as HTMLElement;
}

const caja = (el: HTMLElement) => el.querySelector(".oim-image-fill") as HTMLElement | null;
// The stroke drawing: the svg that is a direct child of the slot, not the clip path inside the picture.
const figura = (el: HTMLElement) => (Array.from(el.children).find((h) => h.tagName.toLowerCase() === "svg")!.firstElementChild) as Element;

describe("image fill in shapes", () => {
  it("a circle with a picture: an img framed by the crop, clipped by the silhouette", async () => {
    const el = await slotDe({ fillType: "image", fillImage: FOTO, fillImageCrop: { x: 20, y: 70, zoom: 2 } });
    const img = caja(el)!.querySelector("img") as HTMLImageElement;
    expect(img.style.objectPosition).toBe("20% 70%");
    expect(img.style.transform).toBe("scale(2)");
    const clip = el.querySelector('clipPath[clipPathUnits="objectBoundingBox"]');
    expect(clip).not.toBeNull();
    expect(caja(el)!.style.clipPath).toBe(`url(#${clip!.id})`);
  });

  it("without fillImage there is no picture and the shape paints fillColor", async () => {
    const el = await slotDe({ fillType: "image", fillColor: "#ff0000" });
    expect(caja(el)).toBeNull();
    expect(figura(el).getAttribute("fill")).toBe("#ff0000");
  });

  it("a failed load removes the picture and the shape shows fillColor", async () => {
    const el = await slotDe({ fillType: "image", fillImage: FOTO, fillColor: "#ff0000" });
    expect(figura(el).getAttribute("fill")).toBe("none");
    caja(el)!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(caja(el)).toBeNull();
    expect(figura(el).getAttribute("fill")).toBe("#ff0000");
  });

  it("the stroke drawing stays above the picture in the DOM", async () => {
    const el = await slotDe({ fillType: "image", fillImage: FOTO, strokeWidth: 3, strokeColor: "#111111" });
    const svgTrazo = Array.from(el.children).find((h) => h.tagName.toLowerCase() === "svg")!;
    expect(caja(el)!.compareDocumentPosition(svgTrazo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a flipped slot puts the picture inside the flip wrapper", async () => {
    const el = await slotDe({ fillType: "image", fillImage: FOTO, flipX: true });
    expect(el.querySelector("[data-oim-flip]")!.contains(caja(el))).toBe(true);
  });

  it("a rectangle with a picture is clipped by a rect with no corner radius", async () => {
    const el = await slotDe({ geoShape: "rect", fillType: "image", fillImage: FOTO }, { id: "c" });
    expect(caja(el)!.querySelector("img")).not.toBeNull();
    const rect = caja(el)!.querySelector("clipPath rect")!;
    expect(rect.getAttribute("rx")).toBe("0");
  });

  it("a rounded rectangle gets its corner radius as a fraction of the box", async () => {
    // slotDe makes a 200 x 200 box, so borderRadius 20 is 0.1 of it.
    const el = await slotDe({ geoShape: "rectangle", fillType: "image", fillImage: FOTO, borderRadius: 20 });
    const rect = caja(el)!.querySelector("clipPath rect")!;
    expect(rect.getAttribute("rx")).toBe("0.1");
    expect(rect.getAttribute("ry")).toBe("0.1");
  });

  it("a rectangle whose photo fails shows its fill colour as the slot background", async () => {
    const el = await slotDe({ geoShape: "rect", fillType: "image", fillImage: FOTO, fillColor: "#ff0000" });
    // Start blank, so the test shows the fallback is what paints the colour.
    el.style.backgroundColor = "transparent";
    caja(el)!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(caja(el)).toBeNull();
    expect(el.style.backgroundColor).toBe("#ff0000");
  });

  it("a negative corner radius is clamped to zero", async () => {
    const el = await slotDe({ geoShape: "rect", fillType: "image", fillImage: FOTO, borderRadius: -20 });
    expect(caja(el)!.querySelector("clipPath rect")!.getAttribute("rx")).toBe("0");
  });

  it("a failed load falls back to the resolved fill color, role included", async () => {
    const el = await slotDe({ fillType: "image", fillImage: FOTO, fillColor: "#ff0000", fillColorRole: "primary" });
    caja(el)!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(figura(el).getAttribute("fill")).toBe("var(--oim-color-primary, var(--oim-palette-primary, #ff0000))");
  });

  it("a network URL is not loaded, as in an image layer", async () => {
    const el = await slotDe({ fillType: "image", fillImage: "https://example.com/a.png", fillColor: "#ff0000" });
    expect(caja(el)).toBeNull();
    expect(figura(el).getAttribute("fill")).toBe("#ff0000");
  });
});
