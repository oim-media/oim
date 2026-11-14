/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Phase 3, text: what a text paints comes from its 2.0 layer.
import { describe, expect, it, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { v2LayersOf } from "../../../scene/src/legacy/v2-layers.js";

async function render(style: object, edit: (layer: any) => void) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const engine: any = new ImageEngine(host as any);
  engine._overlay = document.createElement("div");
  shadow.appendChild(engine._overlay);
  engine.metadata = {
    canvas: { natural_width: 800, natural_height: 600 },
    slots: [{ id: "t", type: "text", position: [10, 10], content: { es: "Hola" }, style: { fontSize: "5cqw", ...style } }],
  };
  // Change the 2.0 layer only: if the renderer still read 1.x, the old paint would show.
  edit(v2LayersOf(engine.metadata).get("t")!);
  await engine.renderSlots();
  return shadow.querySelector('[data-slot-id="t"]') as HTMLElement;
}

describe("a text paints from its 2.0 layer", () => {
  it("its colour", async () => {
    const el = await render({ fillColor: "#ff0000" }, (l) => { l.fills[0].value = "#00ff00"; });
    expect(el.style.getPropertyValue("color")).toBe("#00ff00");
  });

  it("its letters' outline, and no box border", async () => {
    // happy-dom drops -webkit-text-stroke when reading it back: what is checked is what the engine writes.
    const written: [string, string][] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = create(tag);
      const put = el.style.setProperty.bind(el.style);
      el.style.setProperty = (prop: string, val: string, prio?: string) => {
        written.push([prop, val]);
        return put(prop, val, prio);
      };
      return el;
    });
    try {
      await render({ textStrokeWidth: 2, textStrokeColor: "#ff0000", strokeColor: "#0000ff", strokeWidth: 3 }, (l) => {
        l.strokes[0].paint.value = "#00ff00";
        l.strokes[0].width = 4;
      });
    } finally {
      vi.restoreAllMocks();
    }
    expect(written).toContainEqual(["-webkit-text-stroke", "4px #00ff00"]);
    expect(written.find(([p]) => p === "border")).toBeUndefined();
  });

  it("its typography, per language", async () => {
    const el = await render({ fontFamily: "Inter", fontWeight: 400 }, (l) => {
      l.text.font = { family: "Lora", size: { value: 40, modes: { de: 32 } }, weight: 700, italic: true };
      l.text.lineHeight = 1.5;
      l.text.transform = "uppercase";
    });
    expect(el.style.fontSize).toBe("40px");
    expect(el.style.fontFamily).toContain("Lora");
    expect(el.style.fontWeight).toBe("700");
    expect(el.style.fontStyle).toBe("italic");
    expect(el.style.lineHeight).toBe("1.5");
    expect(el.style.textTransform).toBe("uppercase");
  });

  it("its alignment (where it is pinned is the box anchor's job)", async () => {
    const el = await render({ textAlign: "left" }, (l) => { l.text.align = "right"; });
    expect(el.style.textAlign).toBe("right");
    expect(el.style.alignItems).toBe("flex-end");
  });

  it("its highlight and drop cap", async () => {
    const el = await render({}, (l) => {
      l.text.highlight = { enabled: true, color: "#00ff00" };
      l.text.dropCap = { enabled: true, lines: 2 };
    });
    expect(el.outerHTML).toContain("#00ff00");
    expect(el.outerHTML).toMatch(/>H</);
  });

  it("its gradient, clipped to the glyphs", async () => {
    const el = await render(
      { fillType: "gradient", fillGradient: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" },
      (l) => { l.fills[0].gradient.stops[0].color = "#00ff00"; },
    );
    expect(el.outerHTML).toContain("#00ff00");
    expect(el.outerHTML).not.toContain("#ff0000");
  });
});
