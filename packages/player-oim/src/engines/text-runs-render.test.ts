/**
 * @vitest-environment happy-dom
 */
/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import ImageEngine from "./ImageEngine";

function montar(slots: any[], lang: string = "es") {
  const host = document.createElement("div");
  const shadow = (host as any).attachShadow({ mode: "open" });
  document.body.appendChild(host);
  const motor: any = new ImageEngine(host as any);
  motor.lang = lang;
  motor._viewport = document.createElement("div");
  shadow.appendChild(motor._viewport);
  motor._overlay = document.createElement("div");
  motor._viewport.appendChild(motor._overlay);
  motor.metadata = { slots, width: 800, height: 600 };
  return { host, motor };
}

/**
 * The web player lays text out itself and IGNORES `textRuns`.
 *
 * `textRuns` exists for readers that cannot lay out text (Swift, Kotlin,
 * Skia). Until 24 Sept 2026 this test asserted the opposite -that the player
 * painted one fixed-width box per precomputed line- and that was the bug: the
 * editor estimates widths as `0.55 x fontSize` per character, so the lines
 * broke where the real font did not; each box had a width in px, so
 * `textAlign: center` centred nothing and the text did not scale with `cqw`.
 * Measured on a published work: "Multimedia de Objetos Interactivos", one
 * line in the editor, came out as two lines pushed to the left.
 */
describe("ImageEngine — textRuns precalculadas", () => {
  it("el player web ignora textRuns y maqueta el texto el mismo", async () => {
    // The real subtitle of the published work, with the editor's estimate.
    const slot = {
      id: "txt-runs",
      type: "text",
      align: "center",
      width_px: 504,
      height_px: 64,
      position: [18.5, 50.1667],
      content: { es: "Multimedia de Objetos Interactivos" },
      style: {
        fontSize: "3.75cqw",
        textAlign: "center",
        textRuns: {
          es: {
            fontSize: 30,
            lineHeight: 37.5,
            lines: [
              { text: "Multimedia de Objetos", width: 346.5, yOffset: 0 },
              { text: "Interactivos", width: 198, yOffset: 37.5 },
            ],
          },
        },
      },
    };

    const { host, motor } = montar([slot], "es");
    await motor.renderSlots();

    const slotEl = host.shadowRoot!.querySelector('[data-slot-id="txt-runs"]') as HTMLElement;
    expect(slotEl).not.toBeNull();
    // No precomputed lines and no fixed-width boxes: the text is one run the
    // browser wraps and centres with the real font.
    expect(slotEl.querySelectorAll('[data-line-index]').length).toBe(0);
    expect(slotEl.textContent).toContain("Multimedia de Objetos Interactivos");
  });

  it("hace fallback a textContent si el idioma actual no tiene textRuns", async () => {
    const slot = {
      id: "txt-fallback",
      type: "text",
      width_px: 200,
      height_px: 60,
      position: [10, 10],
      content: { es: "Texto en español", en: "Text in English" },
      style: {
        fontSize: "16px",
        textRuns: {
          es: {
            fontSize: 16,
            lineHeight: 20,
            lines: [{ text: "Texto en español", width: 140, yOffset: 0 }],
          },
        },
      },
    };

    const { host, motor } = montar([slot], "en");
    await motor.renderSlots();

    const slotEl = host.shadowRoot!.querySelector('[data-slot-id="txt-fallback"]') as HTMLElement;
    expect(slotEl).not.toBeNull();

    const lines = slotEl.querySelectorAll('[data-line-index]');
    expect(lines.length).toBe(0);
    expect(slotEl.textContent).toContain("Text in English");
  });
});
