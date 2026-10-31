/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// The layer blur is `layerBlur` in the contract, and that is what the editor
// writes. The player only read `blur`, a name outside the schema, so no layer
// from the editor was ever blurred, text or not (parallax depth presets too).

import { describe, it, expect, afterEach } from "vitest";
import ImageEngine from "./ImageEngine";

async function filterOf(type: string, style: Record<string, unknown>) {
  const host = document.createElement("div");
  const sr = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const m: any = new ImageEngine(host as any);
  m._viewport = document.createElement("div"); sr.appendChild(m._viewport);
  m._overlay = document.createElement("div"); m._viewport.appendChild(m._overlay);
  m.metadata = { slots: [{ id: "a", type, content: { es: "Hola" }, position: [50, 50], style: { fontSize: 20, ...style } }] };
  await m.renderSlots();
  return (sr.querySelector('[data-slot-id="a"]') as HTMLElement).style.filter;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("layer blur", () => {
  it("reads layerBlur, the contract's field, on shapes and on text", async () => {
    expect(await filterOf("geo", { layerBlur: 6 })).toContain("blur(6px)");
    expect(await filterOf("text", { layerBlur: 4 })).toContain("blur(4px)");
  });

  it("still honours the old blur field", async () => {
    expect(await filterOf("geo", { blur: 3 })).toContain("blur(3px)");
  });

  it("layerBlur wins when both are present, and zero means no blur", async () => {
    const f = await filterOf("geo", { layerBlur: 5, blur: 9 });
    expect(f).toContain("blur(5px)");
    expect(f).not.toContain("blur(9px)");
    expect(await filterOf("geo", { layerBlur: 0 })).not.toContain("blur(");
  });
});
