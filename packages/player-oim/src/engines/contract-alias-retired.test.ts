/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The player speaks the 1.5.0 contract onwards: one name per concept.
 *
 * The compiler (`canonizar_estilo`) now emits only the canonical names. A player
 * that kept reading the aliases would have TWO readings of the same file, and a
 * second reader written only from the contract would paint differently from the
 * official one.
 *
 * And there was a real bug hidden there: the compiler converts `color` into
 * `fillColor`, but the engine painted the letter with `style.color`. A new text
 * from the editor (`fillColor` without `fillType`) came out signed with no colour.
 */

import { describe, it, expect, vi } from "vitest";
import ImageEngine from "./ImageEngine";
import { buildArtisticTextModelFromSlot } from "../render/artisticText";

function mount(slots: any[]) {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

async function textWith(style: any): Promise<HTMLElement> {
  const { host, motor } = mount([{
    id: "t", type: "text", align: "left",
    position: [50, 50], width_px: 300, height_px: 80,
    content: { es: "hola" },
    style: { fontSize: "48px", ...style },
  }]);
  await motor.renderSlots();
  return host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
}

describe("the letter colour comes from fillColor", () => {
  it("a text with fillColor and without fillType is painted in that colour", async () => {
    const el = await textWith({ fillColor: "#1b3a6b" });
    expect(el.style.color.toLowerCase()).toBe("#1b3a6b");
    // And not as background: in a text, fillColor is the letter.
    expect(el.style.backgroundColor).toBe("");
  });

  it("with a dynamic role, the role wins and fillColor is the fallback", async () => {
    // happy-dom discards `var()` when reading `style.color`: what is checked is what the
    // engine WRITES, as in dynamic-colors-render.test.ts.
    const escritas: [string, string][] = [];
    const crear = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = crear(tag);
      const put = el.style.setProperty.bind(el.style);
      el.style.setProperty = (prop: string, val: string, prio?: string) => {
        escritas.push([prop, val]);
        return put(prop, val, prio);
      };
      return el;
    });
    await textWith({ fillColor: "#18181B", colorRole: "on-surface" });
    vi.restoreAllMocks();
    expect(escritas).toContainEqual(["color", "var(--oim-color-on-surface, var(--oim-palette-on-surface, #18181B))"]);
  });

  it("`color`, retired in 1.5.0, no longer paints anything", async () => {
    const el = await textWith({ color: "#ff0000" });
    expect(el.style.color).toBe("");
  });
});

describe("typography: only the full keys", () => {
  it("fontWeight, fontStyle and textDecoration reach the CSS", async () => {
    const el = await textWith({ fontWeight: 700, fontStyle: "italic", textDecoration: "underline" });
    expect(el.style.fontWeight).toBe("700");
    expect(el.style.fontStyle).toBe("italic");
    expect(el.style.textDecoration).toBe("underline");
  });

  it("bold, italic and underline, retired in 1.5.0, are ignored", async () => {
    const el = await textWith({ bold: true, italic: true, underline: true });
    expect(el.style.fontWeight).toBe("");
    expect(el.style.fontStyle).toBe("");
    expect(el.style.textDecoration).toBe("");
  });
});

describe("artistic text", () => {
  const layerItem = (style: any) => ({ id: "a", type: "artistic-text", content: { es: "X" }, style });

  it("reads fontFamily, fontWeight and fillColor", () => {
    const m = buildArtisticTextModelFromSlot(layerItem({ fontFamily: "Poppins", fontWeight: 700, fillColor: "#FF0055" }) as any, "es");
    expect(m.fontFamily).toBe("Poppins");
    expect(m.bold).toBe(true);
    expect(m.fillColor).toBe("#FF0055");
  });

  it("font, bold and color, retired in 1.5.0, fall back to the default values", () => {
    const m = buildArtisticTextModelFromSlot(layerItem({ font: "Poppins", bold: true, color: "#FF0055" }) as any, "es");
    expect(m.fontFamily).toBe("Bangers");
    expect(m.bold).toBe(false);
    expect(m.fillColor).toBe("#FBBF24");
  });
});

describe("structural validation checks the current keys", () => {
  it("a fillColor that is not text or is huge invalidates the layer", async () => {
    const { validateOimMetadata } = await import("../render/security");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: 42 } }] })).toContain("slot[0].style.fillColor invalid");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: "x".repeat(65) } }] })).toContain("slot[0].style.fillColor invalid");
    expect(validateOimMetadata({ slots: [{ style: { fillColor: "#fff" } }] })).toEqual([]);
  });

  it("`color`, retired, is no longer validated: it is not painted", async () => {
    const { validateOimMetadata } = await import("../render/security");
    expect(validateOimMetadata({ slots: [{ style: { color: 42 } }] })).toEqual([]);
  });
});
