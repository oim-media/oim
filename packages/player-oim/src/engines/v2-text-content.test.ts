/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, text: the words a text shows come from its 2.0 layer.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(lang: string, edit: (layer: any) => void) {
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
    slots: [{ id: "t", type: "text", position: [10, 10], content: { es: "viejo", en: "old" }, style: { fontSize: "20px" } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old words would show.
  edit(v2LayersOf(engine.metadata).get("t")!);
  await engine.renderSlots();
  return (shadow.querySelector('[data-slot-id="t"]') as HTMLElement).textContent;
}

describe("a text's words come from its 2.0 layer", () => {
  it("in the language shown", async () => {
    expect(await render("en", (l) => { l.text.content = { es: "hola", en: "hello" }; })).toContain("hello");
    expect(await render("es", (l) => { l.text.content = { es: "hola", en: "hello" }; })).toContain("hola");
  });

  it("a missing translation falls back as in 1.x", async () => {
    expect(await render("fr", (l) => { l.text.content = { es: "hola", en: "hello" }; })).toContain("hello");
    expect(await render("en", (l) => { l.text.content = { es: "hola", en: "" }; })).toContain("hola");
  });

  it("none of 1.x shows through", async () => {
    const shown = await render("es", (l) => { l.text.content = { es: "nuevo" }; });
    expect(shown).toContain("nuevo");
    expect(shown).not.toContain("viejo");
  });
});
