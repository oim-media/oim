/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A 2.0 file that is already on screen changes language in place: the same view
// is kept, and only the words that change are written.
import { describe, expect, it } from "vitest";
import ImageEngine from "./ImageEngine";

const document2 = {
  oim: "2.0.0-draft.1",
  canvas: { width: 800, height: 600 },
  languages: ["en", "es"],
  layers: [
    { id: "titulo", type: "text", box: { x: 80, y: 40, width: 500, height: 80 }, text: { content: { en: "Hello", es: "Hola" } } },
  ],
};

function mount() {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor._viewport = document.createElement("div");
  motor._viewport.className = "oim-viewport";
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._overlay.className = "oim-layer-overlay";
  motor._viewport.appendChild(motor._overlay);
  return { host, motor };
}

describe("a 2.0 file switches language without being loaded again", () => {
  it("the words change on the same view", async () => {
    const { host, motor } = mount();
    const words = () => host.shadowRoot!.querySelector('[data-slot-id="titulo"]')!.textContent;
    motor.lang = "en";
    await motor._applyVerified({ metadata: structuredClone(document2), security: "verified", announce: false }).catch(() => {});
    expect(words()).toContain("Hello");
    const view = motor.metadata;

    motor.setLang("es");
    await new Promise((r) => setTimeout(r, 250));

    expect(motor.metadata).toBe(view);
    expect(words()).toContain("Hola");
    expect(words()).not.toContain("Hello");
  });
});
