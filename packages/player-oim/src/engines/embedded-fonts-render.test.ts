/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";

import ImageEngine from "./ImageEngine";

/** Sandbox: no font is ever requested from a font host. */
const pideTipografias = () =>
  Array.from(document.querySelectorAll("link")).some((l) => /fonts\.(googleapis|gstatic)\.com/.test(l.href));

describe("a layer whose family is embedded", () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.head.querySelectorAll("link").forEach((l) => l.remove());
    host = document.createElement("div");
    host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  const capaDeTexto = { id: "t", type: "text", align: "left", position: [0.1, 0.1], width_px: 300, height_px: 60,
                        content: { es: "Hola" }, style: { fontFamily: "Lora" } };

  const pintar = async (familias: Map<string, string>, slots: any[] = [capaDeTexto]) => {
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    motor._viewport.className = "oim-viewport";
    host.shadowRoot!.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._overlay.className = "oim-layer-overlay";
    motor._viewport.appendChild(motor._overlay);
    (motor as any).embeddedFontFamilies = familias;
    motor.metadata = { canvas_width: 800, canvas_height: 600, slots } as any;
    await motor.renderSlots();
    return host.shadowRoot!.querySelector('[data-slot-id="t"]') as HTMLElement;
  };

  it("is painted with the internal name and Google is not asked", async () => {
    const layerItem = await pintar(new Map([["Lora", "oim-3f9a1c2b-Lora"]]));
    expect(layerItem.style.fontFamily).toContain("oim-3f9a1c2b-Lora");
    expect(pideTipografias()).toBe(false);
  });

  // Before: "without an embedded font it is requested from Google, as before". The player is a
  // sandbox: the family is named and the browser falls back to whatever is installed,
  // with no request at all.
  it("without an embedded font the family is named and NOTHING is requested", async () => {
    const layerItem = await pintar(new Map());
    expect(layerItem.style.fontFamily).toContain("Lora");
    expect(pideTipografias()).toBe(false);
  });
});

describe("a layer that paints no text", () => {
  beforeEach(() => document.head.querySelectorAll("link").forEach((l) => l.remove()));

  it("does not ask Google for the font the editor sets on it anyway", async () => {
    // serializeSlots writes fontFamily "Inter" on EVERY layer, images included:
    // any .oim with an image asked Google for Inter on open.
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
    const motor = new ImageEngine(host as any);
    motor._viewport = document.createElement("div");
    host.shadowRoot!.appendChild(motor._viewport);
    motor._overlay = document.createElement("div");
    motor._viewport.appendChild(motor._overlay);
    motor.metadata = {
      canvas_width: 800, canvas_height: 600,
      slots: [{ id: "i", type: "image", position: [0.1, 0.1], width_px: 100, height_px: 100,
                content: { es: "data:image/png;base64,iVBORw0KGgo=" }, style: { fontFamily: "Inter" } }],
    } as any;
    await motor.renderSlots();
    expect(host.shadowRoot!.querySelector('[data-slot-id="i"]')).not.toBeNull();
    expect(pideTipografias()).toBe(false);
  });
});
