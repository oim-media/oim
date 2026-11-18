/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { doc2, paintedEngine, shape2, text2 } from "./scene-engine.fixture";

/** Sandbox: no font is ever requested from a font host. */
const asksForFonts = () =>
  Array.from(document.querySelectorAll("link")).some((l) => /fonts\.(googleapis|gstatic)\.com/.test(l.href));

const lora = (fonts?: object[]) => doc2([text2("t", { es: "Hola" }, { text: { content: { es: "Hola" }, font: { family: "Lora", size: 16 } } })], fonts ? { fonts } : {});

describe("the player asks no font host", () => {
  beforeEach(() => document.head.querySelectorAll("link").forEach((l) => l.remove()));

  it("an embedded family is painted by its internal name, and nothing is requested", async () => {
    const { el } = await paintedEngine(lora([{ family: "Lora", name: "oim-3f9a1c2b-Lora", weight: 400, style: "normal", format: "woff", data: "d09GRgABAAAA" }]));
    expect(el("t")!.style.fontFamily).toContain("oim-3f9a1c2b-Lora");
    expect(asksForFonts()).toBe(false);
  });

  it("without an embedded font the family is named and NOTHING is requested", async () => {
    const { el } = await paintedEngine(lora());
    expect(el("t")!.style.fontFamily).toContain("Lora");
    expect(asksForFonts()).toBe(false);
  });

  it("a 1.x image layer with the editor's fontFamily asks for nothing either", async () => {
    const { el } = await paintedEngine({
      canvas_width: 800, canvas_height: 600,
      slots: [{ id: "i", type: "image", position: [0.1, 0.1], width_px: 100, height_px: 100, content: { es: "data:image/png;base64,iVBORw0KGgo=" }, style: { fontFamily: "Inter" } }],
    });
    expect(el("i")).not.toBeNull();
    expect(asksForFonts()).toBe(false);
  });
});
