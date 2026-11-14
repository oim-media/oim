/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, image: its picture, fit and crop come from the 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

const A = "data:image/png;base64,AA";
const B = "data:image/png;base64,BB";
const OLD = "data:image/png;base64,ZZ";

async function render(lang: string, style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  host.setAttribute("mode", "full");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.lang = lang;
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "i", type: "image", position: [10, 10], width_px: 100, height_px: 100, content: { "*": OLD }, style: { width: 10, height: 10, ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old picture would show.
  edit(v2LayersOf(engine.metadata).get("i")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="i"] img') as HTMLImageElement | null;
}

describe("an image comes from its 2.0 layer", () => {
  it("its picture, and a language's own exception", async () => {
    const src = { value: A, modes: { en: B } };
    expect((await render("es", {}, (l) => { l.image.src = src; }))!.getAttribute("src")).toBe(A);
    expect((await render("en", {}, (l) => { l.image.src = src; }))!.getAttribute("src")).toBe(B);
  });

  it("a language whose exception is empty shows no picture", async () => {
    expect(await render("en", {}, (l) => { l.image.src = { value: A, modes: { en: "" } }; })).toBeNull();
  });

  it("its fit and crop", async () => {
    const img = await render("es", { objectFit: "fill" }, (l) => { l.image.src = A; l.image.fit = "contain"; });
    expect(img!.style.objectFit).toBe("contain");
    const cropped = await render("es", {}, (l) => { l.image.src = A; l.image.crop = { x: 0.5, y: 0.5, zoom: 2 }; });
    expect(cropped!.style.transform).not.toBe("");
    const plain = await render("es", { imageCrop: { x: 0.5, y: 0.5, zoom: 2 } }, (l) => { l.image.src = A; delete l.image.crop; });
    expect(plain!.style.transform).toBe("");
  });
});
